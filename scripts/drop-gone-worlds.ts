import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { goneWorlds, readWorktrees } from './lib/worlds.ts';

const HELP = `
drop-gone-worlds - forget the worlds of worktrees that are gone

  node drop-gone-worlds.ts --list
  node drop-gone-worlds.ts --drop

Every checkout keeps its world in a database of its own in the one MongoDB on this machine,
villages for the main checkout and villages-<folder> for a worktree, and RabbitMQ carries it in
a virtual host of the same name. A worktree deleted leaves both behind, which nothing reads
again. This finds them: every database and virtual host of the game's whose checkout git no
longer has a folder for. The worlds of checkouts that are still here, whether or not anything
is serving them, are never touched, and nor is the end-to-end test's world of one.

  --list    say which worlds are gone - how many events each holds and how big it is, and
            which virtual hosts - and drop nothing.
  --drop    drop them, and say which went.
  --help    this.

It asks MongoDB through the mongosh inside its container, docker compose exec on
infra/docker-compose.yml, and RabbitMQ through its management page on localhost:15672, so it
needs Docker running and the stack up, and nothing installed here. Seconds. A world dropped is
gone for good; there is no undoing it. See decision records 0092 and 0094.

  node drop-gone-worlds.ts --list
`;

const { values } = parseArgs({
  options: {
    list: { type: 'boolean', default: false },
    drop: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

/** The stack's RabbitMQ management page, as the user the stack makes. */
const RABBIT = 'http://localhost:15672/api';
const AS = { Authorization: `Basic ${Buffer.from('villages:villages').toString('base64')}` };

// The answer is the exit code, set rather than given to process.exit, which on Windows can abort Node while what
// it printed is still on its way out.
if (values.help || (!values.list && !values.drop)) console.log(HELP);
else process.exitCode = await forgetGone(values.drop);

/** Lists the worlds and virtual hosts whose checkout is gone, and drops them when asked to. */
async function forgetGone(drop: boolean): Promise<number> {
  const root = resolve(import.meta.dirname, '..');
  const git = spawnSync('git', ['-C', root, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' });
  if (git.status !== 0) {
    console.error(`git could not list the checkouts of ${root}: ${git.stderr.trim()}`);
    return 1;
  }
  const checkouts = readWorktrees(git.stdout);

  const worlds = mongo<{ name: string; bytes: number; events: number }[]>(
    root,
    `db.adminCommand({ listDatabases: 1 }).databases.map((d) => ({ name: d.name, bytes: Number(d.sizeOnDisk),
       events: db.getSiblingDB(d.name).events.estimatedDocumentCount() }))`,
  );
  if (worlds === null) return 1;
  const hosts = await rabbit<{ name: string }[]>('/vhosts');

  const game = (name: string) => name === 'villages' || name.startsWith('villages-');
  const goneDatabases = goneWorlds(
    worlds.map((w) => w.name),
    checkouts,
  );
  const hostNames = (hosts ?? []).map((h) => h.name).filter(game);
  const goneHosts = goneWorlds(hostNames, checkouts);
  const kept = worlds.filter((w) => game(w.name) && !goneDatabases.includes(w.name));

  const inRabbit = hosts === null ? '' : ` and ${count(hostNames.length, 'virtual host')} in RabbitMQ`;
  console.log(
    `\n${count(checkouts.length, 'checkout')} of this repository, ${count(kept.length + goneDatabases.length, 'world')} in MongoDB${inRabbit}.\n`,
  );
  const verb = drop ? 'dropping' : 'gone    ';
  for (const w of kept) console.log(`  kept     ${w.name}  ${describe(w)}`);
  for (const name of goneDatabases)
    console.log(`  ${verb} ${name}  ${describe(worlds.find((w) => w.name === name)!)}`);
  for (const name of hostNames.filter((h) => !goneHosts.includes(h)))
    console.log(`  kept     ${name}  virtual host`);
  for (const name of goneHosts) console.log(`  ${verb} ${name}  virtual host`);

  const gone = goneDatabases.length + goneHosts.length;
  if (gone === 0) {
    console.log('\nNothing belongs to a checkout that is gone, so there is nothing to drop.\n');
    return hosts === null ? 1 : 0;
  }
  if (!drop) {
    console.log(
      `\n${gone === 1 ? 'One belongs' : `${gone} of them belong`} to no checkout there is. Dropped by: node drop-gone-worlds.ts --drop\n`,
    );
    return hosts === null ? 1 : 0;
  }

  const dropped =
    goneDatabases.length === 0
      ? []
      : mongo<string[]>(
          root,
          `${JSON.stringify(goneDatabases)}.filter((name) => db.getSiblingDB(name).dropDatabase().ok === 1)`,
        );
  if (dropped === null) return 1;
  const deleted: string[] = [];
  for (const name of goneHosts) {
    const answer = await fetch(`${RABBIT}/vhosts/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: AS,
    })
      .then((a) => a.status)
      .catch(() => 0);
    if (answer === 204 || answer === 404) deleted.push(name);
  }
  console.log(
    `\nDropped ${dropped.length} of ${goneDatabases.length} ${goneDatabases.length === 1 ? 'world' : 'worlds'}${list(dropped)}, and deleted ${deleted.length} of ${goneHosts.length} virtual ${goneHosts.length === 1 ? 'host' : 'hosts'}${list(deleted)}.\n`,
  );
  return dropped.length === goneDatabases.length && deleted.length === goneHosts.length && hosts !== null
    ? 0
    : 1;
}

/** Asks the mongosh in the stack's container, and hands back what the expression came to. */
function mongo<T>(root: string, expression: string): T | null {
  const compose = join(root, 'infra', 'docker-compose.yml');
  const asked = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      compose,
      'exec',
      '-T',
      'mongodb',
      'mongosh',
      '--quiet',
      '--eval',
      `JSON.stringify(${expression})`,
    ],
    { encoding: 'utf8' },
  );
  if (asked.status !== 0 || asked.error !== undefined) {
    const why = asked.error?.message ?? asked.stderr.trim();
    console.error(
      `MongoDB could not be asked: ${why}\nIs Docker running, and the stack up? docker compose -f ${compose} ps`,
    );
    return null;
  }
  return JSON.parse(asked.stdout.trim()) as T;
}

/** Asks RabbitMQ's management page; null, said, when it does not answer, and the virtual hosts are left alone. */
async function rabbit<T>(path: string): Promise<T | null> {
  try {
    const answer = await fetch(`${RABBIT}${path}`, { headers: AS });
    if (!answer.ok) throw new Error(`${answer.status} ${await answer.text()}`);
    return (await answer.json()) as T;
  } catch (unanswered) {
    console.error(
      `RabbitMQ could not be asked, so its virtual hosts are left as they are: ${String(unanswered)}\nIs the stack up?`,
    );
    return null;
  }
}

/** A world in a few words: how many events it holds and how much room it takes. */
function describe(world: { bytes: number; events: number }): string {
  return `${count(world.events, 'event')}, ${(world.bytes / 1024).toFixed(0)} kB`;
}

/** A number and what it counts, one or many: 1 event, 13 events. */
function count(n: number, thing: string): string {
  return `${n} ${thing}${n === 1 ? '' : 's'}`;
}

/** The names, after a colon, or nothing when there are none. */
function list(names: readonly string[]): string {
  return names.length === 0 ? '' : `: ${names.join(', ')}`;
}

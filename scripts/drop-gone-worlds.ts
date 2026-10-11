import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { goneWorlds, readWorktrees } from './lib/worlds.ts';

const HELP = `
drop-gone-worlds - forget the worlds of worktrees that are gone

  node drop-gone-worlds.ts --list
  node drop-gone-worlds.ts --drop

Every checkout keeps its world in a database of its own in the one MongoDB on this machine,
villages for the main checkout and villages-<folder> for a worktree. A worktree deleted leaves
its database behind, which nothing reads again. This finds them: every database of the game's
whose checkout git no longer has a folder for. The worlds of checkouts that are still here,
whether or not anything is serving them, are never touched.

  --list    say which worlds are gone, how many events each holds and how big it is, and drop
            nothing.
  --drop    drop them, and say which went.
  --help    this.

It asks MongoDB through the mongosh inside its container, docker compose exec on
infra/docker-compose.yml, so it needs Docker running and the stack up, and nothing installed
here. Seconds. A world dropped is gone for good; there is no undoing it. See decision record
0092.

  node drop-gone-worlds.ts --list
`;

const { values } = parseArgs({
  options: {
    list: { type: 'boolean', default: false },
    drop: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

// The answer is the exit code, set rather than given to process.exit, which on Windows can abort Node while what
// it printed is still on its way out.
if (values.help || (!values.list && !values.drop)) console.log(HELP);
else process.exitCode = forgetGone(values.drop);

/** Lists the worlds whose checkout is gone, and drops them when asked to. */
function forgetGone(drop: boolean): number {
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

  const gone = goneWorlds(
    worlds.map((w) => w.name),
    checkouts,
  );
  const kept = worlds.filter(
    (w) => (w.name === 'villages' || w.name.startsWith('villages-')) && !gone.includes(w.name),
  );
  console.log(
    `\n${count(checkouts.length, 'checkout')} of this repository, and ${count(kept.length + gone.length, 'world')} in MongoDB.\n`,
  );
  for (const w of kept) console.log(`  kept     ${w.name}  ${describe(w)}`);
  for (const name of gone)
    console.log(
      `  ${drop ? 'dropping' : 'gone    '} ${name}  ${describe(worlds.find((w) => w.name === name)!)}`,
    );

  if (gone.length === 0) {
    console.log('\nNo world belongs to a checkout that is gone, so there is nothing to drop.\n');
    return 0;
  }
  if (!drop) {
    console.log(
      `\n${gone.length === 1 ? 'One belongs' : `${gone.length} of them belong`} to no checkout there is. Dropped by: node drop-gone-worlds.ts --drop\n`,
    );
    return 0;
  }
  const dropped = mongo<string[]>(
    root,
    `${JSON.stringify(gone)}.filter((name) => db.getSiblingDB(name).dropDatabase().ok === 1)`,
  );
  if (dropped === null) return 1;
  console.log(`\nDropped ${dropped.length} of ${gone.length}: ${dropped.join(', ')}.\n`);
  return dropped.length === gone.length ? 0 : 1;
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

/** A world in a few words: how many events it holds and how much room it takes. */
function describe(world: { bytes: number; events: number }): string {
  return `${count(world.events, 'event')}, ${(world.bytes / 1024).toFixed(0)} kB`;
}

/** A number and what it counts, one or many: 1 event, 13 events. */
function count(n: number, thing: string): string {
  return `${n} ${thing}${n === 1 ? '' : 's'}`;
}

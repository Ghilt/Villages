import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  MEASURES,
  keptHistory,
  landingsOf,
  linkMissing,
  minutesFor,
  planOf,
  withLongerScannerWait,
  worldStepsOf,
} from './lib/history.ts';
import type { HistoryPoint, Measure } from './lib/history.ts';

const HELP = `
perf-history - measure what the game cost as it was built, back through main's history

  node perf-history.ts --dry-run
  node perf-history.ts --run

The performance tools keep a point each time work reaches main (decision record 0106). This
measures the commits that came before: landings of main spread evenly in time, each checked out
in a tree of its own, its world made by the world steps its own quick start names, and measured
by this tree's tools - the shaders, the zoom and the start since the world drawn now, the tests
for those and for a few before - each point kept as history in this tree's
docs/experiments/performance/, the oldest first, so no commit meets files a newer one made.

  --dry-run          say which commits it would measure, what each is owed and about how long,
                     and stop.
  --run              measure them, one after another. Stopped, it carries on where it was: a
                     commit already kept as history by a measure is passed over by it.
  --count <n>        commits measured by every measure, spread from --drawn-from to main's tip.
                     Default 10.
  --earlier <n>      commits measured by the tests alone, spread from --tests-from up to
                     --drawn-from. Default 5.
  --drawn-from <t>   when the world drawn now reached main: 2026-10-03T10:25:01+02:00.
  --tests-from <t>   default 2026-09-02T12:00, after the first commits, which had no code.
  --commits <a,b>    measure these commits of main instead, each by what its landing is owed.
  --measures <list>  only these, of shaders, zoom, startup, tests.
  --tree <folder>    where the commits are checked out: by default .claude/worktrees/perf-history
                     in the main checkout, on no branch, made when missing and reused. Its
                     packages are installed again only when a commit's lock file changed, and
                     world/source is hard links to the main checkout's. Removed once the whole
                     history is measured; a folder there that is not a worktree is refused.
  --help             this.

It needs what the measures need: this machine's Chrome, the graphics card quiet - a measure that
finds it busy is tried again every ten minutes for two hours - and Docker for the tests that need
it. Each step's whole output is in .logs/perf-history/<commit>-<step>.log in this tree. About half
an hour a commit measured by everything, most of it the shaders; --dry-run says.

  node perf-history.ts --run --commits 41ed01e6,646c8cfa
`;

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    run: { type: 'boolean', default: false },
    count: { type: 'string', default: '10' },
    earlier: { type: 'string', default: '5' },
    'drawn-from': { type: 'string', default: '2026-10-03T10:25:01+02:00' },
    'tests-from': { type: 'string', default: '2026-09-02T12:00:00+02:00' },
    commits: { type: 'string' },
    measures: { type: 'string' },
    tree: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const windows = process.platform === 'win32';
/** This tree: its tools measure, and its history files keep what they find. */
const here = resolve(import.meta.dirname, '..');
const mainRoot = dirname(git(here, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
const tree = resolve(values.tree ?? join(mainRoot, '.claude', 'worktrees', 'perf-history'));
const logs = join(here, '.logs', 'perf-history');
const BUSY_WAIT_MS = 10 * 60_000;
const BUSY_TRIES = 12;
/** The world tool's file whose wait for the virus scanner the history's tree lengthens while it makes a world. */
const SCANNER_WAIT_FILE = 'frontend/packages/world/bin/lib/links.ts';

if (values.help || (!values['dry-run'] && !values.run)) console.log(HELP);
else process.exitCode = await backfill(values.run);

async function backfill(run: boolean): Promise<number> {
  const measures = (values.measures?.split(',').map((each) => each.trim()) ?? [...MEASURES]) as Measure[];
  const unknown = measures.filter((each) => !(MEASURES as readonly string[]).includes(each));
  if (unknown.length > 0) {
    console.error(`there is no measure called ${unknown.join(' or ')}; they are ${MEASURES.join(', ')}`);
    return 1;
  }
  const points = pointsOwed(measures).sort((a, b) => Date.parse(a.landing.at) - Date.parse(b.landing.at));
  console.log(`\n${points.length} commits of main owed a measure, the oldest first:\n`);
  for (const point of points) {
    console.log(
      `  ${point.landing.at.slice(0, 16)}  ${short(point.landing.sha)}  ${point.measures.join(', ')}`,
    );
    console.log(`                    ${subject(point.landing.sha)}`);
  }
  const minutes = minutesFor(points);
  console.log(`\nabout ${Math.floor(minutes / 60)} h ${minutes % 60} min, measured into ${tree}\n`);
  // Only a backfill of the whole history removes the tree: a run of named commits leaves it for the rest.
  if (!run || points.length === 0) {
    if (run && points.length === 0 && values.commits === undefined) removeTree();
    return 0;
  }

  mkdirSync(logs, { recursive: true });
  const said: string[] = [];
  for (const point of points) {
    const name = short(point.landing.sha);
    console.log(`${name} ${point.landing.at.slice(0, 16)}, ${subject(point.landing.sha)}`);
    if (!checkOut(point.landing.sha)) {
      said.push(`${name}: could not be checked out; see ${logOf(name, 'checkout')}`);
      continue;
    }
    const drawn = point.measures.filter((measure) => measure !== 'tests');
    const fresh = !installedFrom('frontend');
    const ready =
      install('frontend', name) &&
      (!point.measures.includes('tests') || install('scripts', name)) &&
      // The game server compiled first, so it answers within its time when a measure starts it; the check of the
      // tests compiles for itself, and the first commits had no server to compile.
      (drawn.length === 0 || step(name, 'compile', gradle(':app:classes'), join(tree, 'backend')));
    if (!ready) {
      said.push(`${name}: its packages or its server did not build; see ${logs}`);
      continue;
    }
    const world = drawn.length > 0 && (await makeWorld(name));
    // A first load right after the packages were installed waits on the virus scanner reading every new file and on
    // Vite's first look at them - 60 to 80 seconds against 4 (2026-10-20) - which is the install's and not the game's.
    // One such load is let go by first, so a start measured here is a dev server's first after a restart.
    if (world && fresh && point.measures.includes('startup')) await letAFirstLoadGoBy(name);
    for (const measure of point.measures) {
      if (measure !== 'tests' && !world) {
        said.push(`${name} ${measure}: not measured, its world was not made; see ${logOf(name, 'world')}`);
        continue;
      }
      const kept = await measured(name, measure, world);
      said.push(`${name} ${measure}: ${kept}`);
      console.log(`  ${measure}: ${kept}`);
    }
  }
  console.log(`\n${said.join('\n')}\n`);
  if (values.commits === undefined && pointsOwed(measures).length === 0) removeTree();
  return said.every((line) => line.endsWith(': kept')) ? 0 : 1;
}

/** The commits still owed a measure: those named, or the landings spread over the history. */
function pointsOwed(measures: readonly Measure[]): HistoryPoint[] {
  const landings = landingsOf(git(here, 'reflog', 'show', '--date=iso-strict', '--format=%H %gd', 'main'));
  const kept = Object.fromEntries(
    MEASURES.map((measure) => {
      const file = join(here, 'docs', 'experiments', 'performance', `${measure}.jsonl`);
      return [measure, keptHistory(existsSync(file) ? readFileSync(file, 'utf8') : '')];
    }),
  ) as Record<Measure, Set<string>>;
  const drawnFrom = values['drawn-from']!;
  if (values.commits === undefined) {
    const counts = { count: Number(values.count), earlierTests: Number(values.earlier) };
    return planOf(landings, { drawnFrom, testsFrom: values['tests-from']!, ...counts }, kept, measures);
  }
  return values.commits.split(',').flatMap((named) => {
    const sha = git(here, 'rev-parse', `${named.trim()}^{commit}`);
    const landing = landings.find((each) => each.sha === sha);
    if (landing === undefined) {
      console.error(`${named} never stood at main's tip, so it has no landing to measure`);
      return [];
    }
    const owed = Date.parse(landing.at) >= Date.parse(drawnFrom) ? MEASURES : (['tests'] as const);
    const left = owed.filter((measure) => measures.includes(measure) && !kept[measure].has(sha));
    return left.length === 0 ? [] : [{ landing, measures: left }];
  });
}

/**
 * The tree at a commit: made the first time, on no branch, and moved there after, whatever the last left in it. A
 * folder there that is not a worktree of its own is refused, never checked out in: git would find the repository
 * above it, the main checkout, and move that instead.
 */
function checkOut(sha: string): boolean {
  const log = logOf(short(sha), 'checkout');
  if (!existsSync(tree))
    return run('git', ['-C', here, 'worktree', 'add', '--detach', tree, sha], here, log) === 0;
  if (!ownTree()) {
    appendFileSync(
      log,
      `${tree} is there but is not a worktree of its own; remove the folder and run again
`,
    );
    return false;
  }
  return run('git', ['-C', tree, 'checkout', '--detach', '--force', sha], tree, log) === 0;
}

/** Whether the tree is a worktree whose top is itself: its own `.git` file, and git agreeing it is the top. */
function ownTree(): boolean {
  if (!existsSync(join(tree, '.git'))) return false;
  const top = spawnSync('git', ['-C', tree, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).stdout.trim();
  return top !== '' && resolve(top) === resolve(tree);
}

/**
 * A folder's packages, installed with `npm ci` when its lock file is not the one they were installed from: the
 * frontend's, and the scripts' for the check of the tests. A folder with no lock file needs nothing.
 */
function install(folder: 'frontend' | 'scripts', name: string): boolean {
  if (installedFrom(folder)) return true;
  const lock = join(tree, folder, 'package-lock.json');
  const hash = createHash('sha1').update(readFileSync(lock)).digest('hex');
  const stamp = join(tree, folder, 'node_modules', '.perf-history-lock');
  console.log(`  installing the ${folder === 'frontend' ? "frontend's" : "scripts'"} packages`);
  const ok = step(name, `install-${folder}`, npm('ci', '--no-audit', '--no-fund'), join(tree, folder));
  if (ok) writeFileSync(stamp, hash);
  return ok;
}

/** Whether a folder's packages are installed from its lock file as it is now, or it has none to install. */
function installedFrom(folder: 'frontend' | 'scripts'): boolean {
  const lock = join(tree, folder, 'package-lock.json');
  if (!existsSync(tree) || !existsSync(lock)) return existsSync(tree);
  const hash = createHash('sha1').update(readFileSync(lock)).digest('hex');
  const stamp = join(tree, folder, 'node_modules', '.perf-history-lock');
  return existsSync(stamp) && readFileSync(stamp, 'utf8') === hash;
}

/** One start of the tree's dev server and one load of the game, measured and kept nowhere. */
async function letAFirstLoadGoBy(name: string): Promise<void> {
  const args = ['run', 'perf:startup', '--prefix', join(here, 'frontend'), '--', '--tree', tree];
  await runAsync('npm', [...args, '--loads', '0', '--no-built', '--anyway'], here, logOf(name, 'warming'));
}

/**
 * The commit's world, made by the world steps its own quick start names, each run directly and never the quick
 * start, which would start servers and stop others; with world/source hard-linked from the main checkout first.
 */
async function makeWorld(name: string): Promise<boolean> {
  linkMissing(join(mainRoot, 'world', 'source'), join(tree, 'world', 'source'));
  const quickStart = join(tree, 'debug-quick-start.ps1');
  const steps = existsSync(quickStart) ? worldStepsOf(readFileSync(quickStart, 'utf8')) : [];
  console.log(`  making its world: ${steps.map((each) => each.script).join(', ')}`);
  const patient = waitLongerForTheScanner(name);
  for (const each of steps) {
    const args = each.args.length === 0 ? [] : ['--', ...each.args];
    // Tried three times: Windows can refuse a rename while the virus scanner reads what was just written.
    let made = false;
    for (let tries = 1; tries <= 3 && !made; tries += 1) {
      if (tries > 1) await new Promise((done) => setTimeout(done, 30_000));
      made = step(name, 'world', npm('run', each.script, ...args), join(tree, 'frontend'));
    }
    if (!made) break;
  }
  if (patient) run('git', ['-C', tree, 'checkout', '--', SCANNER_WAIT_FILE], tree, logOf(name, 'world'));
  return steps.length > 0 && ownTree() && !dirtyTree();
}

/**
 * Lengthens the world tool's wait for the virus scanner from about six seconds to about three minutes, as 1c82c414
 * did on 2026-10-18, in a commit from before it: on a fresh tree Windows refuses to move a folder of thousands of
 * newly linked tiles until the scanner has read them, and the commits of 2026-10-12 to 10-17 gave up first, every
 * try. It changes how long the tool waits, not what it makes; the file is put back before anything is measured.
 */
function waitLongerForTheScanner(name: string): boolean {
  const file = join(tree, SCANNER_WAIT_FILE);
  if (!existsSync(file)) return false;
  const longer = withLongerScannerWait(readFileSync(file, 'utf8'));
  if (longer === null) return false;
  writeFileSync(file, longer);
  appendFileSync(
    logOf(name, 'world'),
    'the world tool waits up to three minutes for the virus scanner, as 1c82c414\n',
  );
  return true;
}

/** Whether the tree has changes beyond its commit, which would mark every point measured in it. */
function dirtyTree(): boolean {
  const said = spawnSync('git', ['-C', tree, 'status', '--porcelain', '--untracked-files=no'], {
    encoding: 'utf8',
  });
  return said.stdout.trim() !== '';
}

/**
 * One measure of the tree, kept as history, tried again while the graphics card is busy: the card's three through the
 * frontend's tools, the tests through the check, the end-to-end test only when the tree's world was made.
 */
async function measured(name: string, measure: Measure, world: boolean): Promise<string> {
  const keep = ['--record', '--why', 'history'];
  const command =
    measure === 'tests'
      ? {
          command: process.execPath,
          args: [join(here, 'scripts', 'check.ts'), '--root', tree, ...keep].concat(
            world ? [] : ['--only', 'backend,frontend,scripts'],
          ),
        }
      : npm('run', `perf:${measure}`, '--prefix', join(here, 'frontend'), '--', '--tree', tree, ...keep);
  for (let tries = 1; tries <= BUSY_TRIES; tries += 1) {
    const log = logOf(name, measure);
    const before = existsSync(log) ? readFileSync(log, 'utf8').length : 0;
    const code = await runAsync(command.command, command.args, here, log);
    const said = readFileSync(log, 'utf8').slice(before);
    if (/% busy before starting/.test(said)) {
      console.log(
        `  ${measure}: the graphics card is busy; trying again in ten minutes (${tries} of ${BUSY_TRIES})`,
      );
      await new Promise((done) => setTimeout(done, BUSY_WAIT_MS));
      continue;
    }
    if (/kept in |Kept in /.test(said)) return code === 0 ? 'kept' : 'kept, though some of it failed';
    return `failed, nothing kept; see ${log}`;
  }
  return 'not measured, the graphics card stayed busy for two hours';
}

/**
 * Removes the tree once nothing is owed, so a finished backfill leaves nothing behind (Adam leaves trees open): its
 * files by Node, which takes the long paths of its packages that git on Windows will not, and then git's record of
 * it. Its world is hard links and its packages' links point inside it, so nothing outside it goes with it.
 */
function removeTree(): void {
  if (!existsSync(tree) || !ownTree()) return;
  rmSync(tree, { recursive: true, force: true, maxRetries: 3 });
  const code = run('git', ['-C', here, 'worktree', 'prune'], here, join(logs, 'remove.log'));
  console.log(
    code === 0
      ? `removed ${tree}`
      : `removed ${tree}, but git still lists it; see ${join(logs, 'remove.log')}`,
  );
}

interface Command {
  readonly command: string;
  readonly args: readonly string[];
}

function npm(...args: string[]): Command {
  return { command: 'npm', args };
}
// Gradle's wrapper is named whole: a shell told not to look in its own folder for commands finds no gradlew.bat.
function gradle(...tasks: string[]): Command {
  const command = windows ? `"${join(tree, 'backend', 'gradlew.bat')}"` : './gradlew';
  return { command, args: ['--console=plain', ...tasks] };
}

/** Runs a step of a point into its log, and says whether it passed. */
function step(name: string, what: string, { command, args }: Command, cwd: string): boolean {
  const log = logOf(name, what);
  const code = run(command, args, cwd, log);
  if (code !== 0) console.log(`  ${what} failed; see ${log}`);
  return code === 0;
}

function logOf(name: string, what: string): string {
  return join(logs, `${name}-${what}.log`);
}

function run(command: string, args: readonly string[], cwd: string, log: string): number {
  mkdirSync(dirname(log), { recursive: true });
  // npm and Gradle's wrapper are scripts only a shell runs on Windows; none of these arguments has a space in it.
  const shell = windows && command !== process.execPath && command !== 'git';
  const asked = shell
    ? spawnSync([command, ...args].join(' '), { cwd, shell: true, encoding: 'utf8' })
    : spawnSync(command, [...args], { cwd, encoding: 'utf8' });
  appendFileSync(log, `$ ${command} ${args.join(' ')}\n${asked.stdout ?? ''}${asked.stderr ?? ''}\n`);
  return asked.status ?? 1;
}

/** As `run`, without holding the event loop, for the measures that take minutes. */
function runAsync(command: string, args: readonly string[], cwd: string, log: string): Promise<number> {
  mkdirSync(dirname(log), { recursive: true });
  appendFileSync(log, `$ ${command} ${args.join(' ')}\n`);
  const shell = windows && command !== process.execPath;
  const child = shell
    ? spawn([command, ...args].join(' '), { cwd, shell: true })
    : spawn(command, [...args], { cwd });
  child.stdout.on('data', (chunk: Buffer) => appendFileSync(log, chunk));
  child.stderr.on('data', (chunk: Buffer) => appendFileSync(log, chunk));
  return new Promise((done) => {
    child.on('error', () => done(1));
    child.on('close', (status) => done(status ?? 1));
  });
}

function git(cwd: string, ...args: string[]): string {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).stdout.trim();
}

function short(sha: string): string {
  return sha.slice(0, 8);
}
function subject(sha: string): string {
  return git(here, 'log', '-1', '--format=%s', sha);
}

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DEFAULT_MASTER, masterNameOf } from '../src/masters.ts';

import { worldCacheDir } from './lib/checkouts.ts';
import { args, flag, named } from './lib/flags.ts';
import { removeHere } from './lib/links.ts';
import { lock } from './lib/locks.ts';
import type { Held } from './lib/locks.ts';
import { REPO, masterAt } from './lib/paths.ts';
import { borrowSources } from './lib/sharedSources.ts';
import { Shelf, borrow, noteBorrowed, treeNameOf } from './lib/worldCache.ts';
import { HashMemo, fingerprintsOf } from './lib/worldKeys.ts';
import type { Fingerprint } from './lib/worldKeys.ts';
import { statesOf } from './lib/worldState.ts';
import type { StepState } from './lib/worldState.ts';
import { WORLD_STEPS, forMaster } from './lib/worldSteps.ts';
import type { StepName, WorldStep } from './lib/worldSteps.ts';

/**
 * Makes a master's world current in this tree: each world step borrowed from the world cache when it has the entry
 * this tree's inputs name, and made, filed and borrowed when nobody has made it yet. The one way the world is
 * built, for the quick start and the debug panel alike. See decision record 0095 and `docs/plans/world-cache.md`.
 *
 *   node bin/readyWorld.ts [master] [--only tile,flow] [--force] [--why]
 *
 * `--only` makes those steps and every step made from them; `--force` makes them again even when the world cache
 * has them; `--why` says where each step stands and what moved, and makes nothing.
 */

const started = Date.now();
const since = (from = started) => {
  const seconds = (Date.now() - from) / 1000;
  const whole = Math.round(seconds);
  return seconds < 90 ? `${seconds.toFixed(1)}s` : `${Math.floor(whole / 60)}m${whole % 60}s`;
};
const say = (line: string) => console.log(line);

const masterPath = masterAt(named[0]);
const master = masterNameOf(basename(masterPath)) ?? DEFAULT_MASTER;
if (!existsSync(masterPath)) {
  console.error(`no master at ${masterPath}`);
  process.exit(1);
}
const only = flag('only')?.split(',') as StepName[] | undefined;
const unknown = (only ?? []).filter((name) => !WORLD_STEPS.some((step) => step.name === name));
if (unknown.length > 0) {
  console.error(`no world step is called ${unknown[0]}: ${WORLD_STEPS.map((step) => step.name).join(', ')}`);
  process.exit(1);
}
const force = args.includes('--force');
const tree = treeNameOf(REPO);
const shelf = new Shelf(worldCacheDir());
const memo = new HashMemo(shelf.hashesFile());

/** The steps asked for, and every step made from one of them, in the order they are made. */
function chosen(): Set<StepName> {
  const wanted = new Set<StepName>(only ?? WORLD_STEPS.map((step) => step.name));
  for (const step of WORLD_STEPS) {
    if (step.after.some((before) => wanted.has(before))) wanted.add(step.name);
  }
  return wanted;
}

const lent = borrowSources();
if (lent.files > 0 || lent.said.includes('junction')) say(`world/source: ${lent.said}`);

if (args.includes('--why')) {
  for (const state of statesOf(master, REPO, shelf, memo)) {
    say(`${state.name.padEnd(8)} ${state.fingerprint.key}  ${state.standing}`);
    for (const line of state.why) say(`           ${line}`);
  }
  memo.save();
  process.exit(0);
}

const treeLock = await lock(shelf.lockOfTree(tree), `world:ready of ${master}, pid ${process.pid}`, {
  waiting: (holder) => say(`waiting for this tree's other run to finish: ${holder}`),
});

/** Runs a step's tool into `making`, its output passed on as it comes, and says what it read. */
function runTool(step: WorldStep, making: string): Promise<{ code: number; said: string; read: string[] }> {
  const reads = join(making, '..', `${basename(making)}.reads`);
  const recorder = pathToFileURL(resolve(REPO, 'frontend/packages/world/bin/lib/recordReads.ts')).href;
  const words = [
    `--max-old-space-size=${step.memory}`,
    '--import',
    recorder,
    resolve(REPO, step.tool),
    ...(step.perMaster ? [masterPath] : []),
    ...step.options,
    '--into',
    making,
  ];
  return new Promise((done) => {
    const child = spawn(process.execPath, words, {
      cwd: resolve(REPO, 'frontend/packages/world'),
      env: { ...process.env, VILLAGES_READS: reads },
    });
    let said = '';
    const pass = (chunk: Buffer, to: NodeJS.WriteStream) => {
      said += chunk.toString();
      to.write(chunk.toString().replace(/^(?=.)/gm, '    '));
    };
    child.stdout.on('data', (chunk: Buffer) => pass(chunk, process.stdout));
    child.stderr.on('data', (chunk: Buffer) => pass(chunk, process.stderr));
    child.on('close', (code) => {
      const read = existsSync(reads) ? readFileSync(reads, 'utf8').split('\n').filter(Boolean) : [];
      removeHere(reads);
      // What it said of where it wrote is said of the tree, which is where the entry is borrowed to.
      done({ code: code ?? 1, said: said.split(`${making}${sep}`).join(''), read });
    });
  });
}

/** The files a tool read that its fingerprint does not count: inside the repository, and none of its inputs. */
function uncounted(fingerprint: Fingerprint, read: string[], making: string): string[] {
  const { step } = fingerprint;
  const allowed = [
    ...step.from.map((input) => resolve(REPO, forMaster(input.path, master))),
    ...Object.keys(fingerprint.parts.code).map((file) => resolve(REPO, file)),
  ];
  const under = [
    making,
    resolve(REPO, 'frontend', 'node_modules'),
    ...step.after.flatMap((before) =>
      WORLD_STEPS.find((one) => one.name === before)!.makes.map((made) =>
        resolve(REPO, forMaster(made.path, master)),
      ),
    ),
  ];
  const lower = (path: string) => (process.platform === 'win32' ? path.toLowerCase() : path);
  return read.filter((file) => {
    const at = lower(file);
    if (!at.startsWith(lower(REPO + sep))) return false;
    if (allowed.some((one) => lower(one) === at)) return false;
    return !under.some((folder) => at === lower(folder) || at.startsWith(lower(folder + sep)));
  });
}

/** Makes the entry a step's fingerprint names, files it, and says why not when it cannot. */
async function make(fingerprint: Fingerprint, why: string[]): Promise<string | undefined> {
  const { step, key, parts } = fingerprint;
  const holding: Held[] = [];
  try {
    holding.push(
      await lock(shelf.lockOfEntry(step.name, key), `${tree}, pid ${process.pid}`, {
        waiting: (holder) => say(`  ${step.name}: ${holder} is making the same entry; waiting for it`),
      }),
    );
    if (shelf.has(step.name, key) !== undefined) {
      return shelf.entryOf(step.name, key);
    }
    if (step.heavy) {
      holding.push(
        await lock(shelf.lockOfHeavy(), `${step.name} of ${master} in ${tree}`, {
          waiting: (holder) =>
            say(`  ${step.name}: waiting for ${holder}, which takes the memory two would need`),
        }),
      );
    }
    say(`  ${step.name}: ${step.doing}, because ${why[0] ?? 'it was asked for'}`);
    const at = Date.now();
    const making = shelf.making(step.name, key);
    const { code, said, read } = await runTool(step, making);
    if (code !== 0) {
      removeHere(making);
      throw new Error(`its tool stopped with exit code ${code}`);
    }
    const stray = uncounted(fingerprint, read, making);
    if (stray.length > 0) {
      removeHere(making);
      throw new Error(
        `its tool read ${relative(REPO, stray[0]!)}, which its fingerprint does not count (worldSteps.ts)`,
      );
    }
    const again = fingerprintsOf(master, { root: REPO, memo: new HashMemo() }).get(step.name)!;
    if (again.key !== key) {
      removeHere(making);
      throw new Error('one of its inputs changed while it ran; run world:ready again');
    }
    const filed = shelf.file(making, { step, key, master, parts, said, madeIn: tree });
    if (filed.entry === undefined) {
      say(`  ${step.name}: nothing filed, because ${filed.problem}`);
      return undefined;
    }
    say(`  ${step.name}: made in ${since(at)}, and filed in the world cache for every tree`);
    return filed.entry;
  } finally {
    for (const held of holding.reverse()) held.release();
  }
}

/** The last thing a tool said when it made an entry, which is what it found. */
const lastWord = (said: string) =>
  said
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) ?? '';

const wanted = chosen();
const tally = { current: 0, borrowed: 0, made: 0, cannot: 0, failed: 0 };
const failed = new Set<StepName>();
try {
  say(`the world of ${master}, in ${tree}:`);
  for (const state of statesOf(master, REPO, shelf, memo) as StepState[]) {
    const { step, key } = state.fingerprint;
    if (!wanted.has(state.name)) continue;
    const upstream = step.after.find((before) => failed.has(before));
    if (upstream !== undefined) {
      say(`  ${state.name}: not made, because ${upstream} was not`);
      failed.add(state.name);
      continue;
    }
    if (state.standing === 'cannot') {
      say(`  ${state.name}: cannot be made, because ${state.why[0]}`);
      tally.cannot += 1;
      failed.add(state.name);
      continue;
    }
    if (state.standing === 'current' && !force) {
      say(`  ${state.name}: ${step.done}, current`);
      tally.current += 1;
      continue;
    }
    let entry =
      !force && shelf.has(state.name, key) !== undefined ? shelf.entryOf(state.name, key) : undefined;
    const problems = entry === undefined ? [] : shelf.problemsWith(state.name, key);
    if (problems.length > 0) {
      say(`  ${state.name}: the world cache's entry was written into (${problems[0]}), so it is made again`);
      shelf.discard(state.name, key);
      entry = undefined;
    }
    if (force) shelf.discard(state.name, key);
    const madeNow = entry === undefined;
    try {
      entry ??= await make(state.fingerprint, force ? ['it was asked for'] : state.why);
    } catch (error) {
      say(`  ${state.name}: not made: ${(error as Error).message}`);
      tally.failed += 1;
      failed.add(state.name);
      continue;
    }
    if (entry === undefined) {
      tally.cannot += 1;
      failed.add(state.name);
      continue;
    }
    borrow(entry, step, master, REPO);
    noteBorrowed(REPO, step.perMaster ? master : '*', state.name, key);
    if (madeNow) {
      tally.made += 1;
    } else {
      tally.borrowed += 1;
      const filed = shelf.has(state.name, key)!;
      const word = lastWord(shelf.saidBy(state.name, key));
      say(
        `  ${state.name}: ${step.done}, borrowed from the world cache, made in ${filed.madeIn}${word ? `: ${word}` : ''}`,
      );
    }
  }
} finally {
  memo.save();
  treeLock.release();
}

const told = Object.entries(tally)
  .filter(([, count]) => count > 0)
  .map(([what, count]) => `${count} ${what}`)
  .join(', ');
say(`${told || 'nothing to do'}, in ${since()}`);
process.exit(tally.failed > 0 ? 1 : 0);

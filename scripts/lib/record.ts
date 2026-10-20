import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { cpus, release, totalmem } from 'node:os';
import { dirname, join, relative } from 'node:path';

import type { Tally } from './checks.ts';

/**
 * What `check.ts --record` keeps of a run of the checks: one line of `docs/experiments/performance/tests.jsonl`, how
 * long each part took and each of its steps, how many tests it ran, and where their time went - the backend's modules
 * and slowest specs, the frontend's slowest test files and Vitest's own account of its time. The performance page reads
 * the same shape, in `frontend/apps/web/src/admin/performance/testsPoints.ts`; nothing here imports it, nor it this
 * (decision record 0082). See decision record 0106.
 */

/** The method a point was measured by, raised whenever what its numbers mean changes, so points of two never mix. */
export const METHOD = 1;

export type Why = 'to-main' | 'history' | 'by-hand';

export interface Took {
  readonly name: string;
  readonly ms: number;
}

export interface KeptPart {
  readonly name: string;
  readonly passed: boolean;
  /** Why it was not run, when it was not: not in the tree checked, or something it needs is missing. */
  readonly notRun?: string;
  readonly ms: number;
  readonly steps: readonly Took[];
  readonly tests: number | null;
  readonly failed: number;
  readonly skipped: number;
  /** Vitest's own account of where its time went, each summed over its workers: transform, import, tests... */
  readonly vitest?: Readonly<Record<string, number>>;
  /** The backend's modules by the time their specs took, summed, the slowest first. */
  readonly modules?: readonly (Took & { readonly tests: number })[];
  /** The slowest test files or specs, the slowest first. */
  readonly slowest?: readonly Took[];
}

export interface TestsPoint {
  readonly method: number;
  readonly why: Why;
  readonly measuredAt: string;
  readonly code: { commit: string; subject: string; landedAt: string | null; dirty: boolean };
  readonly machine: { cpu: string; memory: string; os: string };
  /** Whether Docker answered: the backend's tests that need it ran, and the end-to-end test's restart. */
  readonly docker: boolean;
  readonly ms: number;
  readonly parts: readonly KeptPart[];
}

/** A tally as a point keeps it: none read is no count, not none. */
export function counted(tally: Tally | null): Pick<KeptPart, 'tests' | 'failed' | 'skipped'> {
  return { tests: tally?.tests ?? null, failed: tally?.failed ?? 0, skipped: tally?.skipped ?? 0 };
}

const UNIT: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };

/** A time as Vitest writes it, `34ms`, `14.85s`, `1m 2.3s`, in milliseconds. */
function msOf(said: string): number | null {
  const pieces = [...said.matchAll(/([0-9.]+)\s*(ms|s|m|h)\b/g)];
  if (pieces.length === 0) return null;
  return Math.round(pieces.reduce((sum, [, n, unit]) => sum + Number(n) * UNIT[unit!]!, 0));
}

/**
 * Vitest's own account of its time, its last `Duration  14.85s (transform 32.70s, setup 0ms, import 63.33s, tests
 * 55.55s, environment 34ms)`: the whole, and each stage summed over its workers, which is why they add up to more.
 */
export function vitestDuration(coloured: string): Record<string, number> | null {
  const log = coloured.replace(/\u001b\[[0-9;]*m/g, '');
  const line = [...log.matchAll(/^\s*Duration\s+([^(\r\n]+?)\s*(?:\(([^)]*)\))?\s*$/gm)].pop();
  if (line === undefined) return null;
  const whole = msOf(line[1]!);
  const stages = (line[2] ?? '')
    .split(',')
    .map((stage) => /^\s*(\w+)\s+(.+)$/.exec(stage))
    .filter((match) => match !== null)
    .map((match) => [match[1]!, msOf(match[2]!)] as const)
    .filter((stage): stage is readonly [string, number] => stage[1] !== null);
  return { ...(whole === null ? {} : { whole }), ...Object.fromEntries(stages) };
}

/** The slowest test files of Vitest's JSON report, by how long each took from its first test to its last. */
export function slowestFiles(report: string, root: string, count = 8): Took[] {
  let read: { testResults?: { name?: string; startTime?: number; endTime?: number }[] };
  try {
    read = JSON.parse(report) as typeof read;
  } catch {
    return [];
  }
  return (read.testResults ?? [])
    .filter((file) => typeof file.startTime === 'number' && typeof file.endTime === 'number')
    .map((file) => ({
      name: relative(root, file.name ?? '?').replaceAll('\\', '/'),
      ms: Math.round(file.endTime! - file.startTime!),
    }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, count);
}

/**
 * The time the backend's specs took, from the JUnit reports Gradle writes, one a spec, each with its module: every
 * module's summed, and the slowest specs. Modules are tested side by side, so the sum is more than the part took.
 */
export function specTimes(
  reports: readonly { module: string; xml: string }[],
  count = 8,
): Required<Pick<KeptPart, 'modules' | 'slowest'>> {
  const modules = new Map<string, { ms: number; tests: number }>();
  const specs: Took[] = [];
  for (const { module, xml } of reports) {
    const suite = /<testsuite\b[^>]*>/.exec(xml)?.[0];
    if (suite === undefined) continue;
    const ms = Math.round(Number(/ time="([0-9.]+)"/.exec(suite)?.[1] ?? 0) * 1000);
    const tests = Number(/ tests="([0-9]+)"/.exec(suite)?.[1] ?? 0);
    const spec = /\bname="([^"]*)"/.exec(suite)?.[1]?.split('.').pop() ?? '?';
    const sum = modules.get(module) ?? { ms: 0, tests: 0 };
    modules.set(module, { ms: sum.ms + ms, tests: sum.tests + tests });
    specs.push({ name: `${module}: ${spec}`, ms });
  }
  return {
    modules: [...modules].map(([name, sum]) => ({ name, ...sum })).sort((a, b) => b.ms - a.ms),
    slowest: specs.sort((a, b) => b.ms - a.ms).slice(0, count),
  };
}

/** The machine the checks ran on: its CPU and threads, its memory and its system. */
export function machineOf(): TestsPoint['machine'] {
  return {
    cpu: `${cpus()[0]?.model.trim() ?? 'a CPU'}, ${cpus().length} threads`,
    memory: `${Math.round(totalmem() / 2 ** 30)} GB`,
    os: `${process.platform} ${release()}`,
  };
}

/**
 * What a tree is at: its commit, the commit's subject, when main came to hold it, and whether it has changes beyond.
 * The same reading as the frontend's performance tools make, in `frontend/perf/kept.ts`, which this may not import.
 */
export function codeOf(tree: string): TestsPoint['code'] {
  const git = (...command: string[]) =>
    execFileSync('git', ['-C', tree, ...command], { encoding: 'utf8' }).trim();
  const commit = git('rev-parse', 'HEAD');
  return {
    commit,
    subject: git('log', '-1', '--format=%s'),
    landedAt: landedAt(tree, commit),
    dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  };
}

/** When main first held a commit, by its reflog, the oldest entry first; null when it never has. */
export function landedAt(tree: string, commit: string): string | null {
  const entries = execFileSync(
    'git',
    ['-C', tree, 'reflog', 'show', '--date=iso-strict', '--format=%H %gd', 'main'],
    { encoding: 'utf8' },
  )
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const [sha, said] = line.split(' ');
      return [sha ?? '', /\{(.+)\}/.exec(said ?? '')?.[1] ?? ''] as const;
    })
    .reverse();
  for (const [sha, at] of entries) {
    if (sha === commit) return at;
    try {
      execFileSync('git', ['-C', tree, 'merge-base', '--is-ancestor', commit, sha], { stdio: 'ignore' });
      return at;
    } catch {
      // not yet held by this entry
    }
  }
  return null;
}

/** The scripts of a folder's package.json, by name; none when it has none. */
export function npmScripts(cwd: string): Record<string, string> {
  const file = join(cwd, 'package.json');
  if (!existsSync(file)) return {};
  return (JSON.parse(readFileSync(file, 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {};
}

/** The scripts an npm script runs, when all it does is run others one after another, `npm run a && npm run b`. */
export function scriptsRunBy(script: string): string[] | null {
  const named = script.split('&&').map((each) => /^\s*npm run ([\w:-]+)\s*$/.exec(each)?.[1]);
  return script.trim() === '' || named.some((name) => name === undefined) ? null : (named as string[]);
}

export function keep(file: string, point: TestsPoint): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(point)}\n`);
}

/** Keeps a recorded run as a line of this tree's `tests.jsonl`, and says where and as what. */
export function keepRun(
  here: string,
  root: string,
  why: Why,
  ms: number,
  parts: readonly KeptPart[],
  docker: boolean,
): string {
  const file = join(here, 'docs', 'experiments', 'performance', 'tests.jsonl');
  const code = codeOf(root);
  keep(file, {
    ...{ method: METHOD, why, measuredAt: new Date().toISOString(), code, machine: machineOf() },
    ...{ docker, ms, parts },
  });
  return `Kept in ${file}, as ${code.commit.slice(0, 7)}${code.dirty ? ' with changes' : ''}.\n`;
}

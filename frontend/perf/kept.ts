import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { alike, readShaderPoints } from '../apps/web/src/admin/performance/shaderPoints.ts';
import type { KeptPlace, Point } from '../apps/web/src/admin/performance/shaderPoints.ts';

export type { KeptPlace, Point, Why } from '../apps/web/src/admin/performance/shaderPoints.ts';

/**
 * A point kept: one line of `docs/experiments/performance/shaders.jsonl` for one run of the measure, in the tree the
 * tool runs from whatever tree it measured, so the history of every commit gathers in one file that travels to main.
 * A line says what it measured (the commit, and when main came to hold it), why (a landing on main, the history found
 * afterwards, or by hand), on what machine, by which method, and each place's reading with its parts. What a
 * hand-over measures is never kept: it is compared against the last point and left in `.logs/perf/`.
 */

/** The method a point was measured by. Raised whenever what a reading means changes, so points of two never mix. */
export const METHOD = 1;

const rounded = (ms: number) => Math.round(ms * 1000) / 1000;

/** A place's reading as a point keeps it: to the microsecond, and only the parts that cost something. */
export function keptPlace(place: {
  name: string;
  lat: number;
  lon: number;
  zoom: number;
  settled: boolean;
  draws: Readonly<Record<string, number>>;
  seat?: string;
  reading: { frame: number; p50: number; p80: number; cpu: number; keys: Readonly<Record<string, number>> };
}): KeptPlace {
  const { reading } = place;
  return {
    name: place.name,
    lat: rounded(place.lat),
    lon: rounded(place.lon),
    zoom: rounded(place.zoom),
    frame: rounded(reading.frame),
    p50: rounded(reading.p50),
    p80: rounded(reading.p80),
    cpu: rounded(reading.cpu),
    keys: Object.fromEntries(
      Object.entries(reading.keys)
        .filter(([, ms]) => ms >= 0.005)
        .sort((a, b) => b[1] - a[1])
        .map(([key, ms]) => [key, rounded(ms)]),
    ),
    draws: Object.fromEntries(
      Object.entries(place.draws)
        .sort((a, b) => b[1] - a[1])
        .map(([key, n]) => [key, Math.round(n * 10) / 10]),
    ),
    settled: place.settled,
    ...(place.seat === undefined ? {} : { seat: place.seat }),
  };
}

/** The points in a file's text, lines that are not points let go by: the page's reading of them. */
export function pointsIn(text: string): Point[] {
  return readShaderPoints(text).points;
}

export function readPoints(file: string): Point[] {
  return existsSync(file) ? pointsIn(readFileSync(file, 'utf8')) : [];
}

export function keep(file: string, point: Point): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(point)}\n`);
}

/** The last point measured as this one is: by the same method, on the same card, at the same size. */
export function lastLike(points: readonly Point[], like: Pick<Point, 'method' | 'machine'>): Point | null {
  return [...points].reverse().find((point) => alike(point, like)) ?? null;
}

/** Where a tree's points are kept. */
export function shadersFile(tree: string): string {
  return join(tree, 'docs', 'experiments', 'performance', 'shaders.jsonl');
}

/** What a tree is at: its commit, the commit's subject, when main came to hold it, and whether it has changes beyond. */
export function codeOf(tree: string): Point['code'] {
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

/**
 * When main first held a commit, by its reflog, the oldest entry first: the time of the first entry the commit is in.
 * Null when no entry has it - a branch not yet brought to main.
 */
export function landedAt(tree: string, commit: string): string | null {
  // `%gd` with a strict date is the entry's own time, `main@{2026-10-19T21:04:11+02:00}`: when main moved there.
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
    const holds =
      sha === commit ||
      (() => {
        try {
          execFileSync('git', ['-C', tree, 'merge-base', '--is-ancestor', commit, sha], { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      })();
    if (holds) return at;
  }
  return null;
}

/** The master a tree draws by default, as its world package names it. */
export function masterOf(tree: string): string | null {
  const file = join(tree, 'frontend', 'packages', 'world', 'src', 'masters.ts');
  if (!existsSync(file)) return null;
  return /DEFAULT_MASTER\s*=\s*'([^']+)'/.exec(readFileSync(file, 'utf8'))?.[1] ?? null;
}

/**
 * The points `npm run perf:startup` keeps, one line of `docs/experiments/performance/startup.jsonl` each: how long the
 * game took to start and where that time went, for the first load after the dev server started, for a load again,
 * for the built page, and for a player's first visit, the built page in a browser that has nothing compiled or cached. Read by the performance page; the tool writes them by these types. Kept apart from the
 * shaders' points because a start is not a place: what is the same - which points compare, a point's name, the line
 * one chart draws - is the shaders' reader's (`shaderPoints.ts`). See decision record 0106.
 */

// With its extension, because the performance tools in `frontend/perf/` run this on Node, which looks for no other.
import { readLines } from './shaderPoints.ts';
import type { Measured, Why } from './shaderPoints';

/** A stretch of the start: its long tasks, its frames, the worst gap between two of them and the gaps a player sees. */
export interface Span {
  readonly longTasks: { readonly count: number; readonly total: number; readonly longest: number };
  readonly frames: number;
  readonly worstGap: number;
  /** Gaps between frames of 50 ms or more: three frames lost at sixty a second. */
  readonly janky: number;
}

/** A function or a module, and the CPU's milliseconds spent in it. */
export interface Spent {
  readonly name: string;
  readonly ms: number;
}

/** A program the page waited on the graphics driver to compile, by its name, for so many milliseconds. */
export interface Compiled {
  readonly name: string;
  readonly ms: number;
}

/** One load of the game, from the page opening. */
export interface Load {
  /**
   * When the start was done for the player, from when the page was asked for: the loading screen lifted, or before
   * there was one, the map drawn; null when never.
   */
  readonly ready: number | null;
  readonly readyBy: 'lifted' | 'drawn' | 'tiles' | null;
  /** Times the page loaded itself again before it was ready, as the dev server makes it the first time. */
  readonly reloads: number;
  /** When each mark of the start was first seen: map, style, sprites, drawn, screen, lifted. */
  readonly at: Readonly<Record<string, number>>;
  /** Up to ready, and the five seconds after it, when a player is already looking. */
  readonly before: Span;
  readonly after: Span;
  /** What was fetched up to five seconds after ready, by kind: code, tiles, pictures, world, other. */
  readonly requests: Readonly<Record<string, { readonly count: number; readonly kb: number }>>;
  /** Where the CPU's time went up to ready, and after it: the most first. */
  readonly cpu: { readonly busy: number; readonly idle: number; readonly gc: number };
  readonly modules: readonly Spent[];
  readonly functions: readonly Spent[];
  readonly afterModules: readonly Spent[];
  readonly afterFunctions: readonly Spent[];
  /**
   * The programs compiled up to five seconds after ready that the page waited on, the longest first; absent from points
   * kept before compiles were watched (2026-10-20).
   */
  readonly compiles?: readonly Compiled[];
}

export interface StartupPoint extends Measured {
  readonly why: Why;
  readonly machine: {
    readonly gpu: string;
    readonly cpu: string;
    readonly chrome: string;
    readonly viewport: string;
  };
  /**
   * The first load after the dev server started, the middle of the loads again, the built page's middle, and the
   * middle of the first visits; absent from points kept before first visits were measured (2026-10-21).
   */
  readonly loads: {
    readonly first: Load | null;
    readonly again: Load | null;
    readonly built: Load | null;
    readonly visit?: Load | null;
  };
  /** How many loads again, of the built page and first visits the middle was taken from. */
  readonly of: number;
}

export function readStartupPoints(text: string): { points: StartupPoint[]; unreadable: number } {
  return readLines<StartupPoint>(text, (value) => {
    const point = value as Partial<StartupPoint> | null;
    return typeof point?.method === 'number' && typeof point.loads === 'object' && point.loads !== null;
  });
}

/** The loads a point has, by what the page calls them. */
export const LOADS = [
  {
    key: 'first',
    words: 'first load',
    what: 'the first load after the dev server started: everything worked out anew',
  },
  { key: 'again', words: 'load again', what: 'a load again on the same dev server, the middle of several' },
  {
    key: 'built',
    words: 'built page',
    what: 'the page as it is built for a player, in a browser that has loaded it before, the middle of several',
  },
  {
    key: 'visit',
    words: 'first visit',
    what: "the built page in a browser of its own, nothing compiled or cached: a player's first visit, the middle of several",
  },
] as const;

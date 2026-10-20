/**
 * What a run of frames comes to. The same frame, drawn back to back on a busy card at the same clock, takes one of two
 * times a fifth to a quarter apart, frame by frame (2026-10-19: the tundra 3.2 or 4.0 ms), as though something else on
 * the card - Chrome's own compositing, likeliest - now and then lands inside the timing; and how many frames land in
 * the slower of the two changes from one round to the next. So what is kept is the **fast frames**: the frames whose
 * whole is at or below the twentieth percentile, averaged, name by name, which stay in the faster of the two as long
 * as a fifth of the frames do. The middle and the eightieth percentile of the whole are kept beside it, as how far the
 * frames spread.
 */

/**
 * One frame: the CPU's milliseconds for it, the graphics card's by what drew, and in how many runs each was timed,
 * a query each.
 */
export interface Frame {
  readonly cpu: number;
  readonly keys: Readonly<Record<string, number>>;
  readonly runs?: Readonly<Record<string, number>>;
}

export interface Reading {
  /** The fast frames' whole, in milliseconds of the graphics card. */
  readonly frame: number;
  readonly p50: number;
  readonly p80: number;
  /** The middle frame's milliseconds of the CPU: the map's drawing and the sprite canvas's, as the page asks for them. */
  readonly cpu: number;
  /** The fast frames' milliseconds by what drew, adding up to `frame`. */
  readonly keys: Readonly<Record<string, number>>;
  /** How many runs each was timed in, on average over the fast frames. */
  readonly runs: Readonly<Record<string, number>>;
  /** How many frames it was read from, and how many of them were the fast ones. */
  readonly frames: number;
  readonly fast: number;
}

export function wholeOf(frame: Frame): number {
  return Object.values(frame.keys).reduce((sum, ms) => sum + ms, 0);
}

/** The value at a share of the way through, nought to one, of values already sorted. */
export function percentile(sorted: readonly number[], share: number): number {
  if (sorted.length === 0) return Number.NaN;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(share * (sorted.length - 1))))]!;
}

export function readingOf(frames: readonly Frame[], fastShare = 0.2): Reading {
  const wholes = frames.map(wholeOf).sort((a, b) => a - b);
  const cut = percentile(wholes, fastShare);
  const fast = frames.filter((frame) => wholeOf(frame) <= cut);
  const keys: Record<string, number> = {};
  const runs: Record<string, number> = {};
  for (const frame of fast) {
    for (const [key, ms] of Object.entries(frame.keys)) keys[key] = (keys[key] ?? 0) + ms / fast.length;
    for (const [key, n] of Object.entries(frame.runs ?? {})) runs[key] = (runs[key] ?? 0) + n / fast.length;
  }
  return {
    frame: fast.reduce((sum, frame) => sum + wholeOf(frame), 0) / Math.max(1, fast.length),
    p50: percentile(wholes, 0.5),
    p80: percentile(wholes, 0.8),
    cpu: percentile(
      frames.map((frame) => frame.cpu).sort((a, b) => a - b),
      0.5,
    ),
    keys,
    runs,
    frames: frames.length,
    fast: fast.length,
  };
}

/** A place's reading: the frame as a whole, and its parts with what timing them cost taken back out. */
export interface Combined extends Reading {
  /** What one query cost the frame, in milliseconds: the parts' sum over the whole, shared out over the runs. */
  readonly perRun: number;
  /** The parts as timed, before that is taken out, over the whole. */
  readonly partsOverWhole: number;
}

/**
 * The frame's cost from bursts timed as a whole, one query a canvas a frame; what drew from bursts timed run by run,
 * taken alternately with them. Each run's query costs the card a little of its own, so the parts add up to more than
 * the whole: that excess is shared out over the runs, and each part loses its runs' share. A part never goes below
 * nought.
 */
export function combine(whole: Reading, parts: Reading): Combined {
  const runs = Object.values(parts.runs).reduce((sum, n) => sum + n, 0);
  const perRun = runs > 0 ? Math.max(0, parts.frame - whole.frame) / runs : 0;
  const keys = Object.fromEntries(
    Object.entries(parts.keys).map(([key, ms]) => [key, Math.max(0, ms - perRun * (parts.runs[key] ?? 0))]),
  );
  return {
    ...whole,
    keys,
    runs: parts.runs,
    perRun,
    partsOverWhole: whole.frame > 0 ? parts.frame / whole.frame : 1,
  };
}

/** Of two readings of one place, the faster: a round the card spent in its slower step says less about the code. */
export function faster<R extends Reading>(one: R, other: R): R {
  return other.frame < one.frame ? other : one;
}

/** How far apart the largest and the smallest of some readings are, as a share of their middle. */
export function spreadOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = percentile(sorted, 0.5);
  return middle > 0 ? (sorted.at(-1)! - sorted[0]!) / middle : 0;
}

/** One of the replay's three paces, the slowest 1. */
export type Pace = 1 | 2 | 3;

/** How fast a replay plays at each pace: a second of the challenge in this many milliseconds. */
export const PACE_MS: Record<Pace, number> = { 1: 700, 2: 350, 3: 140 };

/** The pace after this one, round from the fastest to the slowest again. */
export function nextPace(pace: Pace): Pace {
  return pace === 3 ? 1 : ((pace + 1) as Pace);
}

/** The second shown after `elapsed` milliseconds of playing from `from`, at a pace, stopping at the last. */
export function secondAt(from: number, elapsed: number, pace: Pace, last: number): number {
  return Math.min(last, from + Math.floor(elapsed / PACE_MS[pace]));
}

/** A second a scrub was let go at, whole and inside the challenge. */
export function scrubbedTo(value: number, last: number): number {
  return Math.max(0, Math.min(last, Math.round(value)));
}

/** Where a second stands along the replay, as a share of its length. */
export function shareAlong(second: number, last: number): number {
  return last <= 0 ? 0 : (Math.max(0, Math.min(last, second)) / last) * 100;
}

/**
 * The tug second by second as the points of a line across a box `width` by `height`: the first side's end at the
 * top, the other's at the bottom, even through the middle.
 */
export function linePoints(tug: readonly number[], width: number, height: number): string {
  if (tug.length === 0) {
    return '';
  }
  const across = tug.length === 1 ? 0 : width / (tug.length - 1);
  return tug
    .map((value, at) => {
      const clamped = Math.max(-100, Math.min(100, value));
      return `${(at * across).toFixed(1)},${((1 - (clamped + 100) / 200) * height).toFixed(1)}`;
    })
    .join(' ');
}

/** The stretches of a replay's happenings that have been seen: those begun by the furthest second seen, cut there. */
export function seenBands<B extends { readonly from: number; readonly to: number }>(
  bands: readonly B[],
  seen: number,
): B[] {
  return bands
    .filter((band) => band.from <= seen)
    .map((band) => ({ ...band, to: Math.min(band.to, Math.max(seen, band.from)) }));
}

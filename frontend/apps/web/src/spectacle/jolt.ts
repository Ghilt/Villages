import type { Field, SideKey, SliceNow } from './replay';

/** The colour of a jolt into a slice a happening matches. */
export const MATCHED = 'var(--ui-gilt-light)';

/** The colour a jolt reaches a slice in: gold for one the happening matches, its aspect's for one answering it. */
export function joltColour(slice: SliceNow): string | null {
  if (slice.state === 'matching') return MATCHED;
  if (slice.state === 'answering') return `var(--ui-aspect-${slice.aspect})`;
  return null;
}

/** A happening's jolt: which it is, and the houses it runs to, each in the colour of what it lights there. */
export interface SpectacleJolt {
  readonly key: number;
  readonly to: readonly { readonly side: SideKey; readonly colour: string }[];
}

/**
 * The jolt going on at a second: the happening that arrived on it or the one before, so the light runs its course
 * once, and the houses whose slices it lights - gold where one matches, else the colour of one answering it. None
 * before the first second, between arrivals, or for a happening that lights nobody.
 */
export function joltAt(second: number, arrivals: readonly number[], field: Field): SpectacleJolt | undefined {
  if (second < 0) return undefined;
  const key = arrivals.findIndex((at) => second >= at && second <= at + 1);
  if (key < 0) return undefined;
  const to = (['a', 'b'] as const).flatMap((side) => {
    const colours = field.slices[side].map(joltColour).filter((colour): colour is string => colour !== null);
    if (colours.length === 0) return [];
    return [{ side, colour: colours.includes(MATCHED) ? MATCHED : colours[0]! }];
  });
  return to.length === 0 ? undefined : { key, to };
}

import type { Field, SideKey, SliceNow } from './replay';

/** The colour of a jolt into a slice a happening matches. */
export const MATCHED = 'var(--ui-gilt-light)';

/** The colour a jolt reaches a slice in: gold for one the happening matches, its aspect's for one answering it. */
export function joltColour(slice: SliceNow): string | null {
  if (slice.state === 'matching') return MATCHED;
  if (slice.state === 'answering') return `var(--ui-aspect-${slice.aspect})`;
  return null;
}

/** A happening's jolt: which it is, and the slices it strikes, each in the colour of what it lights there. */
export interface SpectacleJolt {
  readonly key: number;
  readonly to: readonly { readonly actor: string; readonly side: SideKey; readonly colour: string }[];
}

/**
 * The jolt going on at a second: the happening that arrived on it or the one before, so the strike runs its course
 * once, and the slices it lights - gold where one matches, its aspect's colour where one answers it. None before the
 * first second, between arrivals, or for a happening that lights nobody.
 */
export function joltAt(second: number, arrivals: readonly number[], field: Field): SpectacleJolt | undefined {
  if (second < 0) return undefined;
  const key = arrivals.findIndex((at) => second >= at && second <= at + 1);
  if (key < 0) return undefined;
  const to = (['a', 'b'] as const).flatMap((side) =>
    field.slices[side].flatMap((slice) => {
      const colour = joltColour(slice);
      return colour === null ? [] : [{ actor: slice.actor, side, colour }];
    }),
  );
  return to.length === 0 ? undefined : { key, to };
}

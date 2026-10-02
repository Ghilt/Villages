/**
 * A slider's arithmetic, and a meter's, which is the same range read without being set: how far along a
 * value is, and where the knob travels. Pure, so that where a knob stands is a test. See
 * docs/UI-COMPONENTS.md.
 */

/**
 * How tall a slider is drawn, by the size asked for, as tall as a button of the same size; its tube, knob
 * and ends are all in proportion. Large is the moodboard's own, as it is painted.
 */
export const SLIDER_HEIGHTS = { small: 32, regular: 44, large: 65 } as const;
export type SliderSize = keyof typeof SLIDER_HEIGHTS;

/** How far along its range a value is, from nought to one, and nought for a range with no length. */
export function shareOf(value: number, min: number, max: number): number {
  if (!(max > min) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * Where the browser's own slider is laid over the painted one, in from each end, so that its thumb's
 * middle travels from the inner edge of the left end to the inner edge of the right - where the painted
 * knob's middle travels - and the knob never stands on either end's ornament. Its thumb is as wide as the
 * knob, so it runs half a knob past each end of that travel.
 */
export function travelOf(
  ends: readonly [number, number],
  knob: number,
): { readonly left: number; readonly right: number } {
  const hundredths = (length: number) => Math.round(length * 100) / 100;
  return { left: hundredths(ends[0] - knob / 2), right: hundredths(ends[1] - knob / 2) };
}

/** A stepper's next value: one step on or back, and no further than either end. */
export function stepped(value: number, by: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value + by));
}

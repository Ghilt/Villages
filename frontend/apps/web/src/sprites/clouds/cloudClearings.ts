import type { IconDrawn } from '../MarksLayer';

/**
 * The clear patches the clouds leave round the marks, worked out from where the marks layer drew its icons this
 * frame. Pure, so which marks get one, and how big, can be held to without a renderer.
 *
 * Near a mark the clouds' cut is lifted, whole over the mark and easing to nothing `clearing` pixels beyond it, so
 * the clouds thin away from their own ragged edges rather than having a circle cut out of them; their shadows keep
 * off the mark the same way. A mark on its way in or out has a patch as much smaller as it is fainter.
 */

/** As many clearings as the shader takes in one frame. */
export const MOST_CLEARINGS = 32;

/** A mark fainter than this has no clearing. */
const FAINTEST = 0.05;

/** One clearing on the screen, in CSS pixels: its middle, and where the lift is whole and where it has eased out. */
export interface Clearing {
  x: number;
  y: number;
  whole: number;
  gone: number;
}

/**
 * The clearings for the icons drawn, at most `MOST_CLEARINGS`: the ones nearest the middle of a screen of `width`
 * by `height` when there are more, so the marks the player is looking at keep theirs.
 */
export function clearingsFrom(
  icons: readonly IconDrawn[],
  clearing: number,
  width: number,
  height: number,
): Clearing[] {
  const middle = { x: width / 2, y: height / 2 };
  const away = (icon: IconDrawn) => Math.hypot(icon.x - middle.x, icon.y - middle.y);
  return icons
    .filter((icon) => icon.alpha >= FAINTEST)
    .sort((a, b) => away(a) - away(b) || a.x - b.x || a.y - b.y)
    .slice(0, MOST_CLEARINGS)
    .map((icon) => {
      const whole = (icon.size / 2) * icon.alpha;
      return { x: icon.x, y: icon.y, whole, gone: whole + clearing * icon.alpha };
    });
}

/** The clearings laid end to end as the shader takes them, four numbers each, and how many there are. */
export function packClearings(clearings: readonly Clearing[], into: Float32Array): number {
  into.fill(0);
  clearings.slice(0, MOST_CLEARINGS).forEach((one, i) => {
    into.set([one.x, one.y, one.whole, one.gone], i * 4);
  });
  return Math.min(clearings.length, MOST_CLEARINGS);
}

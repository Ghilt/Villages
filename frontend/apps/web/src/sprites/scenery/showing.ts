import { WORLD_UNIT_ZOOM, pixelsPerWorldUnit } from '../cameraMath';
import { KINDS } from './kinds';

/**
 * **This is experiment 0006, not a finished part of the game.** It was built to answer one question -
 * how much scenery the browser will draw before it lags - and it answers it. What it is *not* is a
 * world worth looking at: three kinds of the ten Adam named, drawn as a triangle, an ellipse and three
 * blades, scattered by one weight table nobody has tuned. Do not build on the look of it, and do not
 * take the numbers in it for settled. What replaces it is the **world-generator**, in
 * `docs/plans/world-generator.md`.
 */

/**
 * When a piece of scenery is worth drawing, and how much of it is drawn on the way in.
 *
 * Scenery has one form, so it has nothing to trade with: it simply is not there far out, and the
 * painted terrain carries the meaning instead. What it has instead of a crossover is a size at which
 * it becomes worth looking at, and a fade below that.
 *
 * Pure, so the whole rule can be checked without a tile or a canvas.
 */

/** How tall a thing has to stand on the screen before it is drawn whole, in pixels. */
export const READABLE = 10;

/**
 * How many zoom levels a kind takes to arrive.
 *
 * Long enough that a forest gathers rather than appearing, short enough that there is not a wide band
 * of the zoom range showing a ghost of one.
 */
export const FADE = 1.2;

/**
 * How far apart the first of a kind and the last of it arrive, in zoom levels.
 *
 * Every point has a rank fixed for ever, and its rank shifts its own threshold **earlier** by up to
 * this much. So a wood thickens as the camera comes in rather than appearing all at once, and because
 * the shift is earlier rather than later, every kind is still whole by its own zoom - anchoring it the
 * other way would push the smallest kinds past the closest the camera can come, and they would never
 * be seen whole at all.
 */
export const SPREAD = 0.8;

/**
 * The zoom at which a kind of this height is drawn whole.
 *
 * `laterBy` pushes every kind back together, which is the one knob worth having: how far in you have
 * to come before the world furnishes itself is a matter of taste, and Adam's.
 */
export function wholeAt(groundHeight: number, laterBy = 0): number {
  return WORLD_UNIT_ZOOM + Math.log2(READABLE / groundHeight) + laterBy;
}

/**
 * How much of one point is drawn: nought not yet, one whole.
 *
 * Eased at both ends, so a wood gathers rather than switching on. A point's own threshold comes from
 * its rank, so the same points arrive in the same order every time and nothing is ever reshuffled -
 * which is what keeps the fade from being its own kind of flicker.
 */
export function alphaAt(zoom: number, groundHeight: number, rank: number, laterBy = 0): number {
  const whole = wholeAt(groundHeight, laterBy) - (1 - rank) * SPREAD;
  const t = Math.min(1, Math.max(0, (zoom - (whole - FADE)) / FADE));
  return t * t * (3 - 2 * t);
}

/**
 * The zoom below which nothing of a kind is drawn at all, so a whole cell can be skipped without
 * walking its points.
 */
export function nothingBelow(groundHeight: number, laterBy = 0): number {
  return wholeAt(groundHeight, laterBy) - SPREAD - FADE;
}

/** How tall a point stands on the screen right now, which is its ground height in world units. */
export function heightOnScreen(groundHeight: number, zoom: number): number {
  return groundHeight * pixelsPerWorldUnit(zoom);
}

/**
 * The zoom below which no kind of scenery shows anything at all, so the whole layer can be skipped.
 *
 * This is the bound that matters most, and it was found the hard way: without it, the camera's
 * opening zoom of 4 put twenty thousand cells in the view and five million points behind them, and
 * the page hung before the map had drawn a single tile. A cell is 32 world units, so it is eight
 * screen pixels at zoom 4 and four hundred at zoom 10 - the count does not fall gently, it falls by
 * four for every level in.
 */
export function nothingBelowAny(laterBy = 0): number {
  return Math.min(...KINDS.map((kind) => nothingBelow(kind.groundHeight, laterBy)));
}

/**
 * How many cells the layer will hold at once.
 *
 * A second bound under the first, because the first still leaves several hundred cells at the zoom it
 * lets go of. It costs nothing to look at: the zoom where this binds is inside the band where every
 * kind is still at nought alpha, so the ground it refuses to furnish is ground that would have been
 * drawn empty anyway. If that stops being true - a taller kind, a much wider stage - it will show up
 * as scenery arriving in a step rather than gathering, and this is the number to raise.
 */
export const MOST_CELLS = 400;

/** How many cells may be cut in one frame, so arriving somewhere new never blocks on a screenful. */
export const MOST_CUT_AT_ONCE = 16;

/** Whether the view is close enough in, and small enough, for scenery to be worth drawing at all. */
export function worthDrawing(zoom: number, cellsInView: number, laterBy = 0): boolean {
  return zoom >= nothingBelowAny(laterBy) && cellsInView <= MOST_CELLS;
}

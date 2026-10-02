import { WORLD_UNIT_ZOOM, pixelsPerWorldUnit } from '../../geometry/cameraMath';
import { CROSSOVER_STICK } from '../twoForms';

/** All this needs of a kind is how tall it stands. The rest comes from the sprite map. */
export interface Standing {
  groundHeight: number;
}

/**
 * When a piece of scenery is worth drawing, and how it arrives.
 *
 * **The zoom decides whether, and time decides how long.** That is the rule `twoForms.ts` already
 * states for a mark trading its two forms, and it was got wrong here first: scenery faded across a band
 * of zoom, so resting anywhere inside the band left a screen of half-drawn trees indefinitely. A zoom is
 * somewhere you can stop, and a transition wants to be something that finishes. So a threshold decides
 * which scenery belongs on the screen, and `PRESENCE_MS` decides how long it takes to get there.
 *
 * Scenery has one form, so it has nothing to trade with: it simply is not there far out, and the painted
 * terrain carries the meaning instead. What it has instead of a crossover is a size at which it becomes
 * worth looking at.
 *
 * **A kind arrives in steps rather than all at once.** Every point has a rank fixed for ever, and its
 * rank puts it in one of `STEPS` groups; each group crosses its own threshold a little earlier than the
 * next. So a wood gathers as the camera comes in rather than switching on, and every one of those steps
 * is still a thing that finishes. A group is the unit of everything here: of the threshold, of the fade,
 * and of which particles exist at all.
 *
 * Pure, so the whole rule can be checked without a tile or a canvas.
 */

/**
 * How tall a thing has to stand on the screen before it is drawn whole, in pixels.
 *
 * Twenty, and it moved with the sizes. When the kinds doubled in world units this stayed at ten for a
 * moment, and the effect was not "bigger trees" but "trees a whole zoom level further out" - which is
 * both the wrong look and the expensive one, because the number of cells a view spans goes up by four
 * for every level back. Doubling it too means a kind arrives exactly where it used to and is twice the
 * size when it does, which is what was actually asked for.
 */
export const READABLE = 20;

/**
 * How many steps a kind's arrival is broken into.
 *
 * Four, and the number is a trade. One would be a kind switching on across the whole screen at once.
 * Many would be back to a continuous fade in zoom wearing a disguise, and would cost a group's worth of
 * bookkeeping for each. Four is enough that a wood visibly thickens twice on the way in.
 */
export const STEPS = 4;

/**
 * How far apart the first step of a kind and the last one arrive, in zoom levels.
 *
 * The steps shift a kind's threshold **earlier** rather than later, so every kind is still whole by its
 * own zoom - anchoring it the other way would push the smallest kinds past the closest the camera can
 * come, and they would never be seen whole at all.
 */
export const SPREAD = 0.8;

/**
 * The zoom at which a kind of this height is drawn whole.
 *
 * `laterBy` pushes every kind back together, which is the one knob worth having: how far in you have to
 * come before the world furnishes itself is a matter of taste, and Adam's.
 */
export function wholeAt(groundHeight: number, laterBy = 0): number {
  return WORLD_UNIT_ZOOM + Math.log2(READABLE / groundHeight) + laterBy;
}

/** Which group a point belongs to: its kind, and which step of that kind's arrival its rank puts it in. */
export function groupOf(kind: number, rank: number): number {
  const step = Math.min(STEPS - 1, Math.max(0, Math.floor(rank * STEPS)));
  return kind * STEPS + step;
}

/** How many groups a set of kinds has. */
export function groupCount(kinds: readonly Standing[]): number {
  return kinds.length * STEPS;
}

/** The zoom a group arrives at. Step nought is the earliest, the last step is the kind's own zoom. */
export function thresholdOf(kinds: readonly Standing[], group: number, laterBy = 0): number {
  const kind = kinds[Math.floor(group / STEPS)];
  if (kind === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  const step = group % STEPS;
  return wholeAt(kind.groundHeight, laterBy) - (1 - step / (STEPS - 1)) * SPREAD;
}

/**
 * Whether a group belongs on the screen, given where it already is.
 *
 * The stick is what stops a camera resting on a threshold from starting a fresh fade on every jitter of
 * the wheel, exactly as it does for a mark's two forms.
 */
export function wantedAt(threshold: number, zoom: number, alreadyIn: boolean): boolean {
  return alreadyIn ? zoom >= threshold - CROSSOVER_STICK : zoom >= threshold + CROSSOVER_STICK;
}

/** How tall a point stands on the screen right now, which is its ground height in world units. */
export function heightOnScreen(groundHeight: number, zoom: number): number {
  return groundHeight * pixelsPerWorldUnit(zoom);
}

/**
 * The zoom below which no group of any kind belongs on the screen, so the whole layer can be skipped.
 *
 * This is the bound that matters most, and it was found the hard way: without it, the camera's opening
 * zoom of 4 put twenty thousand cells in the view and five million points behind them, and the page hung
 * before the map had drawn a single tile. A cell is 32 world units, so it is eight screen pixels at zoom
 * 4 and four hundred at zoom 10 - the count does not fall gently, it falls by four for every level in.
 */
export function nothingBelowAny(kinds: readonly Standing[], laterBy = 0): number {
  if (kinds.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.min(...kinds.map((kind) => wholeAt(kind.groundHeight, laterBy) - SPREAD)) - CROSSOVER_STICK;
}

/**
 * How many cells the layer will hold at once.
 *
 * A second bound under the first, because the first still leaves several hundred cells at the zoom it
 * lets go of. It costs nothing to look at: the zoom where this binds is inside the band where no group
 * has arrived, so the ground it refuses to furnish is ground that would have been drawn empty anyway.
 */
export const MOST_CELLS = 400;

/**
 * How many cells may be cut in one frame.
 *
 * Eight rather than sixteen. Cutting a cell is a few hundred hashes and a walk over the stands near it,
 * and the moment it is felt is the moment the camera pulls back: the view goes from a handful of cells
 * to hundreds, and every one of them wants cutting at once. Halving what a frame will take doubles the
 * frames it is spread over, which is the difference between a stutter and a settle.
 */
export const MOST_CUT_AT_ONCE = 8;

/** Whether the view is close enough in, and small enough, for scenery to be worth drawing at all. */
export function worthDrawing(
  kinds: readonly Standing[],
  zoom: number,
  cellsInView: number,
  laterBy = 0,
): boolean {
  return zoom >= nothingBelowAny(kinds, laterBy) && cellsInView <= MOST_CELLS;
}

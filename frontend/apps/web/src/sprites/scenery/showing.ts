import { pixelsPerWorldUnit } from '../../geometry/cameraMath';
import { BECOMES_A_MARK_AT, CROSSOVER_STICK } from '../twoForms';

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
 * terrain carries the meaning instead. **Every kind arrives at the one zoom everything on the map changes over
 * at**, `BECOMES_A_MARK_AT`, whatever its size: closer in the map is the world, further out it is the player's
 * marks, and scenery is world. It arrived by its size until 2026-10-15, a tall spruce two levels before the
 * heather, and Adam asked for every sprite to come and go at one zoom (decision record 0096). A group, a kind, is
 * still the unit of the fade and of which particles exist at all.
 *
 * Pure, so the whole rule can be checked without a tile or a canvas.
 */

/** How many steps a kind's arrival is broken into: one, since every kind arrives at once. */
export const STEPS = 1;

/** Which group a point belongs to: its kind, and which step of that kind's arrival its rank puts it in. */
export function groupOf(kind: number, rank: number): number {
  const step = Math.min(STEPS - 1, Math.max(0, Math.floor(rank * STEPS)));
  return kind * STEPS + step;
}

/** The points of a cell, split by group once, because the group is what comes and goes. */
export function splitByGroup<Point extends { kind: number; rank: number }>(
  points: readonly Point[],
): Map<number, Point[]> {
  const by = new Map<number, Point[]>();
  for (const point of points) {
    const group = groupOf(point.kind, point.rank);
    const already = by.get(group);
    if (already === undefined) {
      by.set(group, [point]);
    } else {
      already.push(point);
    }
  }
  return by;
}

/** How many groups a set of kinds has. */
export function groupCount(kinds: readonly Standing[]): number {
  return kinds.length * STEPS;
}

/**
 * The zoom a group arrives at: `BECOMES_A_MARK_AT` for every kind, pushed back by `laterBy`, the debug panel's knob
 * for how far in the world furnishes itself, which is Adam's to turn and nought unless he does.
 */
export function thresholdOf(kinds: readonly Standing[], group: number, laterBy = 0): number {
  return kinds[Math.floor(group / STEPS)] === undefined
    ? Number.POSITIVE_INFINITY
    : BECOMES_A_MARK_AT + laterBy;
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
  return kinds.length === 0 ? Number.POSITIVE_INFINITY : BECOMES_A_MARK_AT + laterBy - CROSSOVER_STICK;
}

/**
 * How many cells the layer will hold at once.
 *
 * A second bound under the first, because the first still leaves hundreds of cells at the zoom it lets go
 * of. A thousand since scenery arrives at 7.5, where a cell is ninety pixels and a 2560 by 1440 screen holds
 * about six hundred of them: at four hundred, a large screen would have refused the scenery the zoom it is
 * meant to arrive at. It still binds only where no group has arrived, so the ground it refuses to furnish is
 * ground that would have been drawn empty anyway.
 */
export const MOST_CELLS = 1000;

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

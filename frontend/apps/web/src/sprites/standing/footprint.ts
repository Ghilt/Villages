import { GROUND_LATTICE, alongU, alongV, frameOf, worldXOf, worldYOf } from '@villages/world';

import { tiltGround } from '../../geometry/cameraMath';
import type { GroundTilt, ScreenPoint } from '../../geometry/cameraMath';

/*
 * A structure's footprint on the ground, as the order the trees are drawn in reads it: the square of the ground's
 * diamonds its base covers, running back from the corner its foot stands on, a side as the catalogue says for its
 * level - the same square its yard is worn round. Turned twenty-six degrees on the ground, and seen from the south,
 * its left and right corners are seldom level. See docs/plans/worked-ground.md and decision record 0110.
 */

const FRAME = frameOf(GROUND_LATTICE);

/** A point of the ground in world units, east and south from the world's top left corner, as the scenery's are. */
export interface GroundPoint {
  x: number;
  y: number;
}

/** A footprint on the ground: its four corners in order round it, the foot first. */
export type GroundFootprint = readonly [GroundPoint, GroundPoint, GroundPoint, GroundPoint];

/**
 * The footprint of a structure whose foot stands at `foot`, on a corner of the diamonds, covering `side` of them along
 * each side; a footprint of nothing but its foot for one the catalogue gives none.
 */
export function footprintAt(foot: GroundPoint, side: number): GroundFootprint {
  const u = Math.round(alongU(FRAME, foot.x, foot.y));
  const v = Math.round(alongV(FRAME, foot.x, foot.y));
  const at = (du: number, dv: number): GroundPoint => ({
    x: worldXOf(FRAME, u - du, v - dv),
    y: worldYOf(FRAME, u - du, v - dv),
  });
  return [at(0, 0), at(side, 0), at(side, side), at(0, side)];
}

/** A footprint's corners where they land on the screen's ground, in the scenery's world units, as its feet are. */
export function tilted(corners: GroundFootprint, tilt: GroundTilt): readonly ScreenPoint[] {
  return corners.map((corner) => tiltGround(corner.x, corner.y, tilt));
}

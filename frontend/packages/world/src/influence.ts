import { closePath, enclose, fenceAround } from './area.ts';
import type { Fence, MasterGrid } from './area.ts';
import { toLngLat, toPixel } from './raster.ts';
import type { Ring } from './raster.ts';
import type { LngLat } from './sphere.ts';

/**
 * The ground a house holds about its seat: the first influence zone the world has.
 *
 * A fence like any other, so it is drawn, counted and read by exactly the code an area drawn by hand is,
 * and it lands on the lattice between master pixels for the same reason: a pixel is inside or outside,
 * two zones drawn flush share their boundary exactly, and the line is where the count changes. See
 * decision record 0032.
 *
 * Worked out from the seat rather than stored. A house's seat is on the event that founded it, and the
 * reach is a number of the game's; keeping the fence as well would be a second place for one fact to be
 * wrong in. A repainted world or a changed reach means a fresh answer, which is the point.
 */

/** How round the ring is. Enough that a staircase of master pixels is what shows, not a polygon. */
const AROUND = 72;

/**
 * The most ground one zone may hold: about a six-hundred-pixel reach, some seven hundred kilometres.
 *
 * An absolute ceiling rather than a multiple of what was asked for, because a cap that grows with the
 * reach refuses nothing. Nothing in the game comes near it; a reach with a zero too many in it does.
 */
export const MOST_GROUND = 1_200_000;

/**
 * The fence a house holds about `seat`, `reach` master pixels out.
 *
 * The circle is drawn in pixel space rather than in degrees, so it is round on the master and stays the
 * same size in kilometres wherever the house is. In longitude and latitude the same ring would be an
 * ellipse that grew towards the poles, which is a fact about the projection and not about the house.
 */
export function influenceZoneAround(seat: LngLat, grid: MasterGrid, reach: number): Fence {
  const middle = toPixel(seat, grid);
  const ring: [number, number][] = [];

  for (let step = 0; step < AROUND; step += 1) {
    const turn = (step / AROUND) * 2 * Math.PI;
    const at = toLngLat(
      middle.x + Math.cos(turn) * reach - 0.5,
      middle.y + Math.sin(turn) * reach - 0.5,
      grid,
    );
    ring.push([at.lng, at.lat]);
  }

  return fenceAround(enclose(closePath(ring) as Ring, grid, MOST_GROUND));
}

import { GROUND_LATTICE, alongU, alongV, frameOf, worldXOf, worldYOf } from '@villages/world';

import { fromMercator, toMercator } from './cameraMath';
import type { LngLat } from './cameraMath';
import { WORLD_MASTER_WIDTH } from './world';

const FRAME = frameOf(GROUND_LATTICE);

/**
 * The corner of the ground's diamonds nearest a place: where a building's foot is drawn, so the front corner of its
 * painted base meets the diamonds its yard is laid on. Less than a world unit from the place, and only the drawing
 * moves: the place the server holds is untouched. See docs/plans/worked-ground.md.
 */
export function onACorner(place: LngLat): LngLat {
  const mercator = toMercator(place);
  const x = mercator.x * WORLD_MASTER_WIDTH;
  const y = mercator.y * WORLD_MASTER_WIDTH;
  const u = Math.round(alongU(FRAME, x, y));
  const v = Math.round(alongV(FRAME, x, y));
  return fromMercator({
    x: worldXOf(FRAME, u, v) / WORLD_MASTER_WIDTH,
    y: worldYOf(FRAME, u, v) / WORLD_MASTER_WIDTH,
  });
}

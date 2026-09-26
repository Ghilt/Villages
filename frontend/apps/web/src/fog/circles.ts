import { reachAcross } from '@villages/protocol';
import type { VisionPointView } from '@villages/protocol';

import { WORLD_MASTER_WIDTH } from '../map/worldStyle';
import { toMercator } from '../sprites/cameraMath';

import { lastingOn } from './describe';

/**
 * A vision point as the fog is drawn from it: a circle in world units, and whether it still gives vision.
 *
 * The server says how far a point sees in kilometres on the ground, because that is a fact about the world;
 * how big that is on the map is `reachAcross`, at the point's own latitude, the arithmetic the gateway holds
 * back what lies outside it by. Mercator keeps a small circle round and scales it by one over the cosine of
 * the latitude, so a radius of 34 km is 28 world units on the equator and 56 at sixty degrees north. See
 * decision record 0061.
 */
export interface FogCircle {
  /** The middle, in world units: the Mercator square, as many units on a side as the master is wide. */
  x: number;
  y: number;
  /** How far it sees, in world units at its own latitude. */
  radius: number;
  /** Still giving vision today, rather than only having revealed what it covered. */
  lasting: boolean;
}

export function circleOf(point: VisionPointView, today: number | null): FogCircle {
  const at = toMercator({ lng: point.place.lon, lat: point.place.lat });
  return {
    x: at.x * WORLD_MASTER_WIDTH,
    y: at.y * WORLD_MASTER_WIDTH,
    radius: reachAcross(point.place.lat, point.radius) * WORLD_MASTER_WIDTH,
    lasting: lastingOn(point, today),
  };
}

/**
 * Whether a place stands in vision: inside a circle that still gives vision, by the same arithmetic the fog is
 * drawn with. What decides whether a thing standing there is drawn over the fog rather than under it.
 */
export function standsInVision(circles: readonly FogCircle[], place: { lng: number; lat: number }): boolean {
  const at = toMercator(place);
  const x = at.x * WORLD_MASTER_WIDTH;
  const y = at.y * WORLD_MASTER_WIDTH;
  return circles.some((circle) => circle.lasting && Math.hypot(x - circle.x, y - circle.y) <= circle.radius);
}

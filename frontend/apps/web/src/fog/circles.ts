import type { VisionPointView } from '@villages/protocol';

import { WORLD_MASTER_WIDTH } from '../map/worldStyle';
import { toMercator } from '../sprites/cameraMath';

import { lastingOn } from './describe';

/**
 * A vision point as the fog is drawn from it: a circle in world units, and whether it still gives vision.
 *
 * The server says how far a point sees in kilometres on the ground, because that is a fact about the world;
 * how big that is on the map is worked out here, at the point's own latitude. Mercator keeps a small circle
 * round and scales it by one over the cosine of the latitude, so a radius of 34 km is 28 world units on the
 * equator and 56 at sixty degrees north. See decision record 0061.
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

/**
 * How many kilometres the whole world is around the equator: the circumference Web Mercator is drawn from,
 * the sphere MapLibre and the tiles share.
 */
export const EQUATOR_KM = 40_075.016686;

/** How many kilometres one world unit covers at a latitude, in degrees. */
export function kilometresPerUnit(lat: number): number {
  return (EQUATOR_KM / WORLD_MASTER_WIDTH) * Math.cos((lat * Math.PI) / 180);
}

export function circleOf(point: VisionPointView, today: number | null): FogCircle {
  const at = toMercator({ lng: point.place.lon, lat: point.place.lat });
  return {
    x: at.x * WORLD_MASTER_WIDTH,
    y: at.y * WORLD_MASTER_WIDTH,
    radius: point.radius / kilometresPerUnit(point.place.lat),
    lasting: lastingOn(point, today),
  };
}

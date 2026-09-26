/**
 * How far a vision point reaches on the map, and whether a place lies within it. The other half of
 * `villages.protocol.Reach` in Kotlin, held to the same vectors in `contracts/fixtures/reach.json`.
 *
 * A circle on the Mercator plane around the point's place, as many kilometres across as it sees at its own
 * latitude: the map's circle, not the globe's. The page draws the fog clear inside it and the gateway sends
 * what stands inside it, so the two must never disagree about where its edge is. See decision record 0061.
 */

import { MERCATOR_EDGE } from './cells';

/** The circumference Web Mercator is drawn from, in kilometres: the sphere the map and the tiles share. */
export const EQUATOR_KM = 40_075.016686;

/** How far a point seeing `kilometres` at latitude `lat` reaches, as a share of the side of the Mercator square. */
export function reachAcross(lat: number, kilometres: number): number {
  return kilometres / (EQUATOR_KM * Math.cos((lat * Math.PI) / 180));
}

function mercatorX(lon: number): number {
  return (lon + 180) / 360;
}

function mercatorY(lat: number): number {
  const radians = (Math.min(MERCATOR_EDGE, Math.max(-MERCATOR_EDGE, lat)) * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / (2 * Math.PI);
}

/** Whether `place` lies within the reach of a point at `centre` that sees `kilometres` around it. */
export function reaches(
  centre: { lat: number; lon: number },
  kilometres: number,
  place: { lat: number; lon: number },
): boolean {
  const across = Math.hypot(
    mercatorX(place.lon) - mercatorX(centre.lon),
    mercatorY(place.lat) - mercatorY(centre.lat),
  );
  return across <= reachAcross(centre.lat, kilometres);
}

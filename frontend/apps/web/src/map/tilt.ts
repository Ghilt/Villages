import { fromMercator, groundTilt, toMercatorExact, untiltGround, worldSize } from '../sprites/cameraMath';

import { CAMERA } from './mapConfig';

/**
 * How far the camera is tipped at each zoom: the tilt is a function of the zoom, not a setting of its own.
 *
 * Straight down from `from` outwards, tipped back `most` degrees at `to`, the closest the camera comes, and
 * eased between them, so zooming in tips the world up to meet you and zooming out lays it flat again. Adam's
 * idea, and experiment 0011. Because the tilt follows from the zoom, anything that needs the tilt for a zoom
 * it has not reached yet - the edge rule in `MapView`, asked about a zoom MapLibre is about to take - works it
 * out here rather than asking the map, so it can never be a frame behind.
 */

export interface TiltRamp {
  /** The zoom at which the camera starts to tip; flat from here out. */
  from: number;
  /** The zoom at which it is tipped all the way; the camera's closest. */
  to: number;
  /** How far it is tipped there, in degrees. */
  most: number;
}

/** The player's: flat at zoom 7 and out, tipped 45 degrees at zoom 10. */
export const PLAYERS_TILT: TiltRamp = { from: CAMERA.tilt.from, to: CAMERA.maxZoom, most: CAMERA.tilt.most };

let ramp: TiltRamp = PLAYERS_TILT;

/** The ramp the map is following now, which the debug panel's Camera section may move. */
export function tiltRamp(): TiltRamp {
  return ramp;
}

export function setTiltRamp(next: TiltRamp): void {
  ramp = next;
}

/**
 * The tilt at a zoom, in degrees.
 *
 * Eased at both ends rather than a straight line, so that zooming through `from` does not start the tip
 * with a jolt and zooming in to `to` does not stop it with one: a straight line would begin at fifteen
 * degrees a zoom level from standing still. The ease is smoothstep, `3t² - 2t³`, which leaves the middle
 * of the ramp a little steeper than a line would to make up for it.
 */
export function tiltAt(zoom: number, along: TiltRamp = ramp): number {
  if (!(along.to > along.from)) {
    return zoom >= along.to ? along.most : 0;
  }
  const t = Math.min(1, Math.max(0, (zoom - along.from) / (along.to - along.from)));
  return along.most * t * t * (3 - 2 * t);
}

/**
 * Where the centre has to go so that tipping from one tilt to another leaves the ground under `anchor`
 * where it is, rather than the ground under the middle of the window.
 *
 * A wheel zoom keeps the ground under the pointer by reading, every frame, which ground is under it now.
 * So a tip about the middle, taken between two frames, moves the ground under the pointer and the next
 * frame keeps the moved ground: measured before this existed, a place a third of the way up from the
 * bottom of the window slid 49 pixels toward the middle between zoom 7.5 and 9. Tipping about the pointer
 * instead leaves nothing for the next frame to keep. The anchor's offset on the ground is read at both
 * tilts through the one projection the marks and the scenery use, and the centre moves by the difference.
 */
export function tippedAbout(
  centre: { lng: number; lat: number },
  zoom: number,
  anchor: { x: number; y: number },
  window: { width: number; height: number },
  from: { pitch: number; bearing: number },
  to: { pitch: number; bearing: number },
): { lng: number; lat: number } {
  const x = anchor.x - window.width / 2;
  const y = anchor.y - window.height / 2;
  const was = untiltGround(x, y, groundTilt(from));
  const now = untiltGround(x, y, groundTilt(to));
  const size = worldSize(zoom);
  const at = toMercatorExact(centre);
  return fromMercator({ x: at.x + (was.east - now.east) / size, y: at.y + (was.south - now.south) / size });
}

import { noiseAt } from './noise.ts';
import type { NoiseField } from './noise.ts';
import { angularDistance, rotate } from './sphere.ts';
import type { EulerAngles, LngLat } from './sphere.ts';

/**
 * One place whose surroundings are dragged somewhere else. The pull fades with distance, so the world
 * bends rather than tearing, and a coastline stays a coastline.
 */
export interface WarpControl {
  lng: number;
  lat: number;
  /** How far the pull reaches, in degrees. Beyond about twice this, nothing moves. */
  radius: number;
  dLng: number;
  dLat: number;
}

export interface WarpConfig {
  /** Turning the globe is powerful and needs antimeridian cutting first, so it defaults to nothing. */
  rotation: EulerAngles;
  controls: readonly WarpControl[];
  noise: NoiseField & { amplitude: number };
  /**
   * Offsets fade to nothing within this many degrees of the antimeridian. Without it, land would be
   * carried across the seam, where Mercator needs a polygon cut in two before it can draw it.
   */
  seamGuard: number;
  /** Mercator cannot draw the poles, so latitude is held inside this band. */
  maxLatitude: number;
}

/** How much of an offset survives near the seam: all of it in the middle of the map, none at the edge. */
export function seamDamping(lng: number, seamGuard: number): number {
  if (seamGuard <= 0) {
    return 1;
  }
  const toSeam = 180 - Math.abs(lng);
  return Math.min(1, Math.max(0, toSeam / seamGuard));
}

/** The pull of every control at one place, added together. Away from all of them, this is nothing. */
export function controlOffset(
  point: LngLat,
  controls: readonly WarpControl[],
): { dLng: number; dLat: number } {
  let dLng = 0;
  let dLat = 0;

  for (const control of controls) {
    const distance = angularDistance(point, { lng: control.lng, lat: control.lat });
    const falloff = Math.exp(-((distance / control.radius) ** 2));
    dLng += control.dLng * falloff;
    dLat += control.dLat * falloff;
  }

  return { dLng, dLat };
}

/**
 * Where a place on Earth ends up in our world.
 *
 * This is the whole world generator: turn the globe, drag it about with the controls, add a wobble, and
 * hold it inside what Mercator can draw. It is a pure function of one point and the configuration, so the
 * same configuration always produces the same world, and the coordinates it returns are the ones the game
 * treats as real. See docs/adr/0017.
 */
export function warpPoint(point: LngLat, config: WarpConfig): LngLat {
  const turned = rotate(point, config.rotation);
  const damping = seamDamping(turned.lng, config.seamGuard);

  const pull = controlOffset(turned, config.controls);
  const wobbleLng = noiseAt(turned.lng, turned.lat, config.noise, 0) * config.noise.amplitude;
  const wobbleLat = noiseAt(turned.lng, turned.lat, config.noise, 1) * config.noise.amplitude;

  const lng = turned.lng + (pull.dLng + wobbleLng) * damping;
  const lat = turned.lat + (pull.dLat + wobbleLat) * damping;

  return {
    lng: Math.min(180, Math.max(-180, lng)),
    lat: Math.min(config.maxLatitude, Math.max(-config.maxLatitude, lat)),
  };
}

/**
 * The little bit of spherical geometry the world generator needs. Longitude and latitude in degrees go in,
 * longitude and latitude in degrees come out, and everything in between is a unit vector.
 */

export interface LngLat {
  lng: number;
  lat: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface EulerAngles {
  /** Turn about the polar axis, which slides the world east or west. */
  yaw: number;
  pitch: number;
  roll: number;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

export function toVector({ lng, lat }: LngLat): Vector3 {
  const phi = toRadians(lat);
  const lambda = toRadians(lng);
  const cosPhi = Math.cos(phi);
  return { x: cosPhi * Math.cos(lambda), y: cosPhi * Math.sin(lambda), z: Math.sin(phi) };
}

export function toLngLat({ x, y, z }: Vector3): LngLat {
  const length = Math.hypot(x, y, z);
  const clamped = Math.min(1, Math.max(-1, z / length));
  return { lng: toDegrees(Math.atan2(y, x)), lat: toDegrees(Math.asin(clamped)) };
}

/**
 * Turn the whole globe. Every coastline keeps its shape exactly; only where it sits changes, which makes a
 * familiar world unfamiliar for free. Beware that any large turn drags land across the antimeridian, where
 * a polygon has to be cut in two before Mercator can draw it, so this is off by default.
 */
export function rotate(point: LngLat, { yaw, pitch, roll }: EulerAngles): LngLat {
  const { x, y, z } = toVector(point);

  const cy = Math.cos(toRadians(yaw));
  const sy = Math.sin(toRadians(yaw));
  const cp = Math.cos(toRadians(pitch));
  const sp = Math.sin(toRadians(pitch));
  const cr = Math.cos(toRadians(roll));
  const sr = Math.sin(toRadians(roll));

  // About the polar axis, then about the axis through the equator, then about the prime meridian.
  const x1 = x * cy - y * sy;
  const y1 = x * sy + y * cy;
  const x2 = x1 * cp + z * sp;
  const z2 = -x1 * sp + z * cp;
  const y3 = y1 * cr - z2 * sr;
  const z3 = y1 * sr + z2 * cr;

  return toLngLat({ x: x2, y: y3, z: z3 });
}

/** The angle between two places, in degrees, which is the honest way to measure nearness on a globe. */
export function angularDistance(a: LngLat, b: LngLat): number {
  const va = toVector(a);
  const vb = toVector(b);
  const dot = Math.min(1, Math.max(-1, va.x * vb.x + va.y * vb.y + va.z * vb.z));
  return toDegrees(Math.acos(dot));
}

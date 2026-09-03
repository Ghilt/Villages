/**
 * The world generator: it turns the real Earth into ours.
 *
 * Pure functions only, so the world is reproducible from its configuration and every part of it can be
 * tested without files or a browser. The build script in `bin` is the only thing here that touches a disk.
 */

export { noiseAt } from './noise.ts';
export type { NoiseField } from './noise.ts';
export { angularDistance, rotate, toLngLat, toVector } from './sphere.ts';
export type { EulerAngles, LngLat, Vector3 } from './sphere.ts';
export { controlOffset, seamDamping, warpPoint } from './warp.ts';
export type { WarpConfig, WarpControl } from './warp.ts';
export { warpCollection, warpGeometry } from './geometry.ts';
export type { Feature, FeatureCollection, Geometry, Position } from './geometry.ts';

/**
 * The world generator: it turns the real Earth into ours, and turns a hand-edited image into the world
 * the game plays on.
 *
 * Pure functions only, so the world is reproducible and every part of it can be tested without files or a
 * browser. The scripts in `bin` are the only things here that touch a disk.
 */

export { noiseAt } from './noise.ts';
export type { NoiseField } from './noise.ts';
export { MAX_MERCATOR_LATITUDE, angularDistance, rotate, toLngLat, toVector } from './sphere.ts';
export type { EulerAngles, LngLat, Vector3 } from './sphere.ts';
export { controlOffset, seamDamping, warpPoint } from './warp.ts';
export type { WarpConfig, WarpControl, WarpOctave } from './warp.ts';
export { warpCollection, warpGeometry } from './geometry.ts';
export type { Feature, FeatureCollection, Geometry, Position } from './geometry.ts';

export {
  MINIMUM_CLASS_DISTANCE,
  byId,
  colourDistance,
  paletteProblems,
  snapToClass,
  toHex,
  toRgb,
} from './palette.ts';
export type { MasterShape, Palette, PaletteProblem, Rgb, Snap, TerrainClass } from './palette.ts';

export {
  classAt,
  classHistogram,
  createRaster,
  fillPolygon,
  strokeLine,
  toPixel as toRasterPixel,
} from './raster.ts';
export type { ClassRaster, Ring } from './raster.ts';

export { chunk, crc32, encodeIndexedPng, encodeRgbPng } from './png.ts';
export type { Deflate, RgbImage } from './png.ts';

export { toLngLat as latticeToLngLat, traceClass } from './trace.ts';
export type { LatticePoint, Ring as LatticeRing } from './trace.ts';

export { doubleSignedArea, simplify, smooth } from './simplify.ts';

export { TILE_SIZE, cutTile, sourceColumnFor, sourceRowFor, tileAddresses, tileCount } from './tiles.ts';
export type { TileAddress } from './tiles.ts';

export { fillUnassigned } from './fill.ts';
export type { FillOptions, FillReport } from './fill.ts';

export {
  fbm,
  hash2,
  mix,
  paintPixel,
  painterlyProblems,
  preparePainterly,
  smoothstep,
  treatment,
  valueNoise,
} from './painterly.ts';
export type {
  ClassSampler,
  GroupStyle,
  PainterlyStyle,
  PreparedPainterly,
  TreatmentKind,
} from './painterly.ts';

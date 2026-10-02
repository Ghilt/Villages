/**
 * The world, as it is made: `@villages/world/build`.
 *
 * Everything the page draws with, which is `@villages/world`, and everything it was made with besides: the
 * warp, the tracer, the rasteriser, the PNG writer, the biome chooser, the stand writer, the art cutter. For
 * what runs at build time - the tests anywhere that build a world to test against, and whatever reaches the
 * generator by its name. The tools in `bin` reach it by relative path, because Node will not strip the types
 * from a file it finds under `node_modules`. Never the page's: see `index.ts`.
 */

export * from './index.ts';

export {
  CANOPY_HEIGHT,
  NO_FAVOURITE,
  PARENT_STEP,
  STAND_BYTES,
  encodeStands,
  favouriteRoll,
  favouritesOf,
  pickKindIn,
  standAt,
  standWeight,
  standsNear,
  thicknessAt,
} from './stands.ts';
export type { Stand, Thickness } from './stands.ts';
export {
  biomeProblems,
  chooseBiome,
  growingTable,
  pickKind,
  regionAt,
  swayAt,
  wanderAt,
  warmthOfLatitude,
  wetnessOfDistance,
} from './biome.ts';
export type {
  Band,
  Biome,
  BiomeAxes,
  BiomeFile,
  BiomeProblem,
  BoundaryRule,
  Growing,
  RegionField,
  StandRule,
  SwayField,
  Where,
} from './biome.ts';
export { backgroundOf, crop, footOf, hasOwnAlpha, keyOut, opaqueBox, packShelves } from './art.ts';
export type { ArtFrame, Box, Keyed, Placed, Rgba } from './art.ts';
export { CUT_AT, asShown } from './uiArt.ts';
export type { UiCut } from './uiArt.ts';
export type { UiWindow } from './uiWindow.ts';
export { noiseAt } from './noise.ts';
export type { NoiseField } from './noise.ts';
export { angularDistance, fromWorld, rotate, toLngLat, toVector, toWorld } from './sphere.ts';
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
export type { MasterShape, PaletteProblem, Rgb, Snap } from './palette.ts';

export { classAt, classHistogram, createRaster, fillPolygon, strokeLine } from './raster.ts';
export type { ClassRaster, Ring } from './raster.ts';

export { chunk, crc32, encodeIndexedPng, encodeRgbPng } from './png.ts';
export type { Deflate, RgbImage } from './png.ts';

export { toLngLat as latticeToLngLat, traceClass } from './trace.ts';
export type { LatticePoint, Ring as LatticeRing } from './trace.ts';

export { doubleSignedArea, simplify, smooth } from './simplify.ts';

export {
  TILE_SIZE,
  cutTile,
  mercatorRowOf,
  sourceColumnFor,
  sourceRowFor,
  tileAddresses,
  tileCount,
} from './tiles.ts';
export type { TileAddress } from './tiles.ts';

export { MOST_ENCLOSED, diamondAt, insideFence, scanGrid, withoutCollinear } from './area.ts';
export type {
  DiamondSpan,
  DiamondWindow,
  EnclosedDiamonds,
  FencePart,
  GridPoint,
  Roughness,
  ScanBounds,
} from './area.ts';

export { SQUARE_LATTICE, alongU, alongV, isSquareLattice } from './lattice.ts';
export type { LatticeFrame } from './lattice.ts';

export { isSafeMasterName, masterNameOf } from './masters.ts';

export { fillUnassigned } from './fill.ts';
export type { FillOptions, FillReport } from './fill.ts';

export { fbm, hash2, mix, painterlyProblems, smoothstep, treatment, valueNoise } from './painterly.ts';
export type { GroupStyle, TreatmentKind } from './painterly.ts';

export { thickestOf } from './scatter.ts';
export type { ClassAt, Ground } from './scatter.ts';
export { biomeCellOf, biomesByColour } from './spriteMap.ts';

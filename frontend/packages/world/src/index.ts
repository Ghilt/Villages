/**
 * The world generator: it turns the real Earth into ours, and turns a hand-edited image into the world
 * the game plays on.
 *
 * Pure functions only, so the world is reproducible and every part of it can be tested without files or a
 * browser. The scripts in `bin` are the only things here that touch a disk.
 */

export {
  CANOPY_HEIGHT,
  NO_FAVOURITE,
  NO_STANDS,
  PARENT_STEP,
  STAND_BYTES,
  decodeStands,
  encodeStands,
  favouriteRoll,
  favouritesOf,
  pickKindIn,
  standAt,
  standWeight,
  standsNear,
  thicknessAt,
} from './stands.ts';
export type { Stand, StandChunk, Thickness } from './stands.ts';
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
  Kind,
  RegionField,
  StandRule,
  SwayField,
  Where,
} from './biome.ts';
export { backgroundOf, crop, footOf, hasOwnAlpha, keyOut, opaqueBox, packShelves } from './art.ts';
export type { ArtAtlasFile, ArtFrame, Box, Keyed, Placed, Rgba } from './art.ts';
export { noiseAt } from './noise.ts';
export type { NoiseField } from './noise.ts';
export {
  MAX_MERCATOR_LATITUDE,
  angularDistance,
  fromWorld,
  rotate,
  toLngLat,
  toVector,
  toWorld,
} from './sphere.ts';
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

export {
  MOST_ENCLOSED,
  areaAround,
  closePath,
  diamondAt,
  diamondLattice,
  enclose,
  enclosedBy,
  fenceAround,
  fenceSize,
  fenceToPolygons,
  fenceWindow,
  insideFence,
  insideFenceAt,
  scanGrid,
  withoutCollinear,
} from './area.ts';
export type {
  DiamondGrid,
  DiamondSpan,
  DiamondWindow,
  EnclosedDiamonds,
  Fence,
  FencePart,
  GridPoint,
  Roughness,
  ScanBounds,
} from './area.ts';

export { SQUARE_LATTICE, alongU, alongV, frameOf, isSquareLattice, worldXOf, worldYOf } from './lattice.ts';
export type { Lattice, LatticeFrame } from './lattice.ts';

export { DEFAULT_MASTER, isSafeMasterName, masterNameOf, worldDirOf } from './masters.ts';

export { fillUnassigned } from './fill.ts';
export type { FillOptions, FillReport } from './fill.ts';

export {
  fbm,
  hash2,
  mix,
  onLattice,
  paintPixel,
  painterlyProblems,
  preparePainterly,
  seedOf,
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

export { CELL, cellOf, reachBeyond, scatterCell, thickestOf } from './scatter.ts';
export type { ClassAt, Ground, ScatteredPoint } from './scatter.ts';
export { biomeAt, biomesByColour } from './spriteMap.ts';
export type { SpriteMap, SpriteMapFile } from './spriteMap.ts';

/** A worked example of a biome file, for the tests of anything that reads one. See `fixture.ts`. */
export { EXAMPLE_BIOMES, EXAMPLE_KINDS } from './fixture.ts';

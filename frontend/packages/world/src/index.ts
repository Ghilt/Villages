/**
 * The world, as the page draws it: `@villages/world`.
 *
 * This package turns the real Earth into ours and a hand-edited image into the world the game plays on, in
 * pure functions only, so that the world is reproducible and every part of it can be tested without files
 * or a browser. The scripts in `bin` are the only things here that touch a disk.
 *
 * It has three doors, and this one is the page's: what the running game reads a world with, and nothing it
 * was made with. A name the page has a use for is added here when it does. The rest of the generator is
 * `@villages/world/build`, for the tools and for the tests that build a world to test against, and the
 * worked examples are `@villages/world/testing`. A page file that reaches through either is an ESLint error.
 */

export { NO_STANDS, decodeStands } from './stands.ts';
export type { StandChunk } from './stands.ts';
export type { Kind } from './biome.ts';
export type { ArtAtlasFile } from './art.ts';
export { PAINTED_AT, UI_BUDGET, UI_KINDS, weightAt } from './uiArt.ts';
export type { Repeat, Sides, UiArtFile, UiBorder, UiKind, UiPicture } from './uiArt.ts';
export { MAX_MERCATOR_LATITUDE } from './sphere.ts';
export type { Palette, TerrainClass } from './palette.ts';

export {
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
  insideFenceAt,
} from './area.ts';
export type { DiamondGrid, Fence } from './area.ts';

export { HEIGHT_BOUNDS, HEIGHT_FORMAT, HEIGHT_MAX_ZOOM } from './height.ts';

export { GROUND_LATTICE, frameOf, worldXOf, worldYOf } from './lattice.ts';
export type { Lattice } from './lattice.ts';

export { DEFAULT_MASTER, worldDirOf } from './masters.ts';

export { decodeOrigin, squareAt, whereFrom } from './originFile.ts';
export { CULTURE_NONE, cultureAt } from './culture.ts';
export {
  DRAWN_CULTURES,
  DRAWN_TYPES,
  INK,
  RUIN_PICTURE,
  hexOf,
  pictureFor,
  pictureKey,
  pictureOf,
  pictureParts,
  pictureSvg,
  styled,
} from './structureLooks.ts';
export type { Inked, Part, Picture } from './structureLooks.ts';
export { markKey } from './structureMarks.ts';
export type { StructureAtlasFile, StructureFrame } from './structureArt.ts';
export type { CultureFile } from './culture.ts';
export type { OriginFile, OriginGrid, WhereFrom } from './originFile.ts';
export { namesAt } from './names.ts';
export { CULTURES, STRUCTURE_RESOURCES, parseStructureCatalogue } from './structures.ts';
export { RARITIES, parseBalance } from './balance.ts';
export type { Balance, BalanceRarity } from './balance.ts';
export { FATE_RESOURCES, dealFrom, opensOn, parseFate } from './fate.ts';
export type { Fate, FateAction, FateDeals, FatePool, FateResource } from './fate.ts';
export type {
  Culture,
  StructureCatalogue,
  StructureResource,
  StructureSlot,
  StructureTypeSpec,
} from './structures.ts';
export type { WorldName } from './names.ts';

export { onLattice, paintPixel, preparePainterly, seedOf } from './painterly.ts';
export type { ClassSampler, PainterlyStyle, PreparedPainterly } from './painterly.ts';

export { CELL, cellOf, reachBeyond, scatterCell } from './scatter.ts';
export type { ScatteredPoint } from './scatter.ts';
export { biomeAt, spriteMapOf } from './spriteMap.ts';
export type { SpriteMap, SpriteMapFile } from './spriteMap.ts';

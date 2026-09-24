/**
 * What the main thread and the painters say to each other, and the facts they both need.
 *
 * Kept apart from both so that the main thread can import the shape of a message without importing the
 * painter itself, which would put a worker's worth of code in the page's bundle.
 */

/**
 * How wide a flat tile is, which is what the terrain is cut into and read back from. The areas, the
 * scenery and the terrain log all mean this one.
 */
export const TILE = 256;

/** Beyond this there are no flat tiles, because a tile pixel is already a master pixel at seven. */
export const FLAT_MAX_ZOOM = 7;

/**
 * How wide a painted tile is, which is not the same number and used to be.
 *
 * Painting is priced per pixel and per tile, and the per-tile half is not small: every tile is a round
 * trip to a painter, an image allocated and handed to the GPU, and a field of terrain assembled from the
 * flat tiles around it - and each painter keeps its own decoded terrain, so neighbouring tiles sent to
 * different painters decode the same flat tiles twice. Four times the pixels a tile is a quarter of all
 * of that for the same ground. See experiment 0008, where a tilted camera doubled the tiles on screen.
 */
export const PAINTED_TILE = 256;

/** How many zoom levels a painted tile is ahead of a flat one: one, for twice the width. */
export const PAINTED_STEP = Math.log2(PAINTED_TILE / TILE);

/**
 * The deepest painted tile MapLibre is allowed to ask for.
 *
 * MapLibre asks a raster source for tile zoom `round(mapZoom + log2(512 / tileSize))`, so at 256 it asked
 * one level deeper than the map's zoom and at 512 it asks the map's own. The painted source used to stop
 * at ten, which at 256 was a ceiling it hit from map zoom 9.5 onward - so the closest half-zoom has always
 * been drawn from tiles at half the resolution, stretched. One less here keeps exactly that at 512: the
 * same pixels at every zoom as before, so the change is only what it costs. Lifting it is sharper at the
 * closest zoom and four times the painting there, which is the wrong direction for this step.
 */
export const PAINTED_MAX_ZOOM = 10 - PAINTED_STEP;

/**
 * Which flat tiles a painted tile needs, and where they sit.
 *
 * A painted tile deeper than the flat tiles lies inside one of them, so it needs that one and a ring of
 * eight around it - three square, as it always was. A painted tile shallower than that, which below zoom
 * seven is every one of them, covers a block of flat tiles two on a side, because it is twice as wide in
 * pixels as they are; so it needs that block and a ring around the block, four square. The ring is what
 * lets the paint look past the edge of what it draws, for the wander and the neighbour reads.
 */
export interface Footprint {
  /** The zoom the flat tiles are read at, which is the finest there is for a pixel of this tile. */
  sourceZoom: number;
  /** The first flat tile the painted tile covers, at that zoom. */
  firstX: number;
  firstY: number;
  /** How many flat tiles it covers along each side: one, or two. */
  cover: number;
  /** The width of the field in flat pixels: the cover and a tile of ring either side. */
  span: number;
}

/**
 * The footprint of one painted tile. `step` is how many zooms a painted tile is ahead of a flat one, which
 * is the live one unless a test is asking about the other size.
 */
export function footprintOf(zoom: number, x: number, y: number, step = PAINTED_STEP): Footprint {
  // As many levels deeper than the painted tile as it is wider than a flat one, so that one flat pixel is
  // one painted pixel - but never past the flat tiles themselves, beyond which a flat pixel is stretched
  // and there is nothing finer to read.
  const sourceZoom = Math.min(zoom + step, FLAT_MAX_ZOOM);
  const ratio = 2 ** (sourceZoom - zoom);
  const cover = Math.max(1, ratio);
  return {
    sourceZoom,
    firstX: Math.floor(x * ratio),
    firstY: Math.floor(y * ratio),
    cover,
    span: (cover + 2) * TILE,
  };
}

export interface PaintRequest {
  id: number;
  style: string;
  /**
   * Where the flat tiles this is painted from live, as the root of a URL. Carried on the request rather
   * than known by the painter, so that which master is being drawn is one decision made in one place.
   */
  tiles: string;
  zoom: number;
  x: number;
  y: number;
  /**
   * The grid the colour is decided on, turned and sized in world units. The square one is what the world
   * is stored on and what every painted tile was before there was a choice. See experiment 0008.
   */
  latticeTurn: number;
  latticeSize: number;
}

export interface PaintReply {
  id: number;
  /**
   * The painted tile, four bytes a pixel, transferred rather than copied. Pixels rather than an
   * `ImageBitmap` because they can be kept and used again: MapLibre closes a bitmap once it has it on
   * the GPU, so a cache of bitmaps would be a cache of dead handles.
   */
  pixels?: ArrayBuffer;
  error?: string;
  /**
   * How long the painter spent on it, in milliseconds: assembling the terrain around it, and painting
   * it. Carried back because the cost of a tile is not visible from the main thread, and without it a
   * change to how tiles are cut is judged by feel alone. See experiment 0008.
   */
  terrainMs?: number;
  paintMs?: number;
}

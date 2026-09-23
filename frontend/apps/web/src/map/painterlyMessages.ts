/**
 * What the main thread and the painters say to each other, and the facts they both need.
 *
 * Kept apart from both so that the main thread can import the shape of a message without importing the
 * painter itself, which would put a worker's worth of code in the page's bundle.
 */

export const TILE = 256;

/** Beyond this there are no flat tiles, because a tile pixel is already a master pixel at seven. */
export const FLAT_MAX_ZOOM = 7;

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
}

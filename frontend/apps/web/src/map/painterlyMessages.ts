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
  zoom: number;
  x: number;
  y: number;
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

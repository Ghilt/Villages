import { TILE_SIZE, toMercator } from '../geometry/cameraMath';
import type { LngLat } from '../geometry/cameraMath';
import { TILE } from '../geometry/world';
import { PAINTED_MAX_ZOOM, PAINTED_TILE, PER_TILE } from './painterlyMessages';

/**
 * Which painted tiles to paint before the map asks for them: the ones around what it asked for once it rests, and
 * the ones a zoom out from where the game starts will ask for. Worked out here, with no worker and no map, so it can
 * be tested; `painterlyTiles.ts` paints them.
 */

/**
 * How deep a ring around the view to paint ahead, in tiles.
 *
 * One was tried and left half the tiles of a screen-sized pan still to paint, because a pan of a whole
 * screen moved two to three 256-pixel tiles. Two covered it. At 512 pixels the same pan is one to one and
 * a half, and one ring is the same ground two was.
 */
export const RING = Math.max(1, Math.round((2 * TILE) / PAINTED_TILE));

/** A bound on how much to paint ahead, so a fast pan cannot queue up a thousand tiles. */
export const MOST_AHEAD = Math.round(140 / PER_TILE);

/** A painted tile, by its zoom and its place at that zoom. */
export interface TileAt {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The zoom out to which a painted tile, once painted, is kept for good rather than thrown away when the store is
 * full: the whole world seen from far out, eighty-five tiles and twenty-two megabytes, so zooming out to it never
 * waits on a painter however long the page has been open.
 */
export const KEPT_TO_ZOOM = 3;

/** Whether a tile is on the map at all: its zoom one that is painted, and its place inside the world. */
function onTheMap({ zoom, x, y }: TileAt): boolean {
  const across = 2 ** zoom;
  return zoom >= 0 && zoom <= PAINTED_MAX_ZOOM && x >= 0 && x < across && y >= 0 && y < across;
}

/**
 * What the map will want next, from what it asked for: the tiles beside each one, `ring` deep, for panning, nearest
 * first, so that what is painted ahead is what a small movement reaches first; the four inside it for zooming in;
 * and the one containing it for zooming out, and the one two out as well, so that there is always a coarse painted
 * version for MapLibre to stretch while a sharp one is still being painted. Each with the request it was found
 * around, which says how it is painted. Rather than reading the camera and doing the arithmetic, this takes what
 * MapLibre actually asked for, so the zoom is always the one MapLibre chose, with no guessing.
 */
export function aroundAsked<R extends TileAt>(asked: readonly R[], ring: number): { from: R; at: TileAt }[] {
  const around: { from: R; at: TileAt }[] = [];
  const consider = (from: R, zoom: number, x: number, y: number): void => {
    const at = { zoom, x, y };
    if (onTheMap(at)) {
      around.push({ from, at });
    }
  };
  for (let deep = 1; deep <= ring; deep += 1) {
    for (const from of asked) {
      for (let dy = -deep; dy <= deep; dy += 1) {
        for (let dx = -deep; dx <= deep; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === deep) {
            consider(from, from.zoom, from.x + dx, from.y + dy);
          }
        }
      }
    }
  }
  for (const from of asked) {
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      consider(from, from.zoom + 1, from.x * 2 + dx, from.y * 2 + dy);
    }
    consider(from, from.zoom - 1, from.x >> 1, from.y >> 1);
    consider(from, from.zoom - 2, from.x >> 2, from.y >> 2);
  }
  return around;
}

/** The painted tiles' zoom at a camera zoom: MapLibre's tiles are 512 pixels, and a painted tile is `PAINTED_TILE`. */
export function paintedZoomAt(zoom: number): number {
  return Math.round(zoom + Math.log2(TILE_SIZE / PAINTED_TILE));
}

/**
 * The painted tiles a zoom out from this camera will ask for, the nearest zoom first and the middle of each first:
 * at every zoom out from the one it is drawn at, a window's width and height of them around the same middle, and a
 * tile more on each side for the tilt and the rounding; then, from `KEPT_TO_ZOOM` out, the whole world.
 */
export function wayOut(view: { centre: LngLat; width: number; height: number; zoom: number }): TileAt[] {
  const middle = toMercator(view.centre);
  const tiles: TileAt[] = [];
  for (let zoom = paintedZoomAt(view.zoom) - 1; zoom >= 0; zoom -= 1) {
    const across = 2 ** zoom;
    const x = middle.x * across;
    const y = middle.y * across;
    const wide = zoom <= KEPT_TO_ZOOM ? across : view.width / PAINTED_TILE / 2 + 1;
    const tall = zoom <= KEPT_TO_ZOOM ? across : view.height / PAINTED_TILE / 2 + 1;
    const here: TileAt[] = [];
    for (let row = Math.floor(y - tall); row <= Math.floor(y + tall); row += 1) {
      for (let column = Math.floor(x - wide); column <= Math.floor(x + wide); column += 1) {
        const at = { zoom, x: column, y: row };
        if (onTheMap(at)) {
          here.push(at);
        }
      }
    }
    const far = (at: TileAt) => (at.x + 0.5 - x) ** 2 + (at.y + 0.5 - y) ** 2;
    tiles.push(...here.sort((a, b) => far(a) - far(b)));
  }
  return tiles;
}

import { groundTilt, pixelsPerWorldUnit, toMercatorExact, untiltGround } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { FLAT_MAX_ZOOM, TILE, WORLD_MASTER_WIDTH } from '../../geometry/world';

import type { LandMotion } from './look';

/**
 * What moves on the land under the view, as the land shader reads it: the flat tiles of the deepest zoom under the
 * view, pieced into one texture, four bytes a world unit, a channel for each land motion drawn, 255 where the
 * ground there has it and nought elsewhere. The shader softens the edges itself, so nothing here is worked out but
 * a lookup a texel.
 */

/**
 * The land motions the land layer draws so far, in the order of the mask's channels: red the grass, green the crops.
 * The others in `LAND_LOOK.lands` stand still until the steps that draw them, and a fifth would need a texture of its
 * own.
 */
export const DRAWN = ['grass', 'crops'] as const satisfies readonly LandMotion[];

export type DrawnMotion = (typeof DRAWN)[number];

/** Which channel of the mask a motion is drawn from, or null for one the layer does not draw. */
export function channelOf(motion: LandMotion | null): number | null {
  const at = (DRAWN as readonly (LandMotion | null)[]).indexOf(motion);
  return at < 0 ? null : at;
}

/** The flat tiles under the view, at the zoom where a tile pixel is a world unit, inclusive. */
export interface TileRange {
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
}

/** No more tiles than this across or down: further out than that the land is not drawn anyway. */
export const MOST_TILES = 6;

/** The world units under a point of the screen: the sprites' own projection, backwards. */
export function groundAt(view: CameraView, x: number, y: number): { x: number; y: number } {
  const centre = toMercatorExact(view.center);
  const scale = pixelsPerWorldUnit(view.zoom);
  const ground = untiltGround(x - view.width / 2, y - view.height / 2, groundTilt(view));
  return {
    x: centre.x * WORLD_MASTER_WIDTH + ground.east / scale,
    y: centre.y * WORLD_MASTER_WIDTH + ground.south / scale,
  };
}

/** The tiles under the view's four corners, or null when there are too many of them to be worth piecing. */
export function tilesUnder(view: CameraView): TileRange | null {
  const corners = [
    groundAt(view, 0, 0),
    groundAt(view, view.width, 0),
    groundAt(view, 0, view.height),
    groundAt(view, view.width, view.height),
  ];
  const across = 2 ** FLAT_MAX_ZOOM;
  const tileOf = (units: number) => Math.min(across - 1, Math.max(0, Math.floor(units / TILE)));
  const range = {
    fromX: tileOf(Math.min(...corners.map((one) => one.x))),
    toX: tileOf(Math.max(...corners.map((one) => one.x))),
    fromY: tileOf(Math.min(...corners.map((one) => one.y))),
    toY: tileOf(Math.max(...corners.map((one) => one.y))),
  };
  const fits = range.toX - range.fromX < MOST_TILES && range.toY - range.fromY < MOST_TILES;
  return fits ? range : null;
}

export function sameRange(one: TileRange | null, other: TileRange | null): boolean {
  return (
    one !== null &&
    other !== null &&
    one.fromX === other.fromX &&
    one.toX === other.toX &&
    one.fromY === other.fromY &&
    one.toY === other.toY
  );
}

/**
 * The mask of a range of tiles, given each tile's class ids row by row from the north-west, null for a tile that is
 * not there, and the channel each class id is drawn in, null for one with no motion drawn. Hands back its size in
 * texels, which is its size in world units, and how many of its texels have each channel's motion, so a view with
 * none of a motion can leave it out and a view with none at all can draw nothing.
 */
export function landMaskOf(
  range: TileRange,
  tiles: readonly (Uint8Array | null)[],
  channels: readonly (number | null)[],
): { width: number; height: number; texels: Uint8Array; counts: number[] } {
  const columns = range.toX - range.fromX + 1;
  const rows = range.toY - range.fromY + 1;
  const width = columns * TILE;
  const height = rows * TILE;
  const texels = new Uint8Array(width * height * 4);
  // A texel's four bytes at once, red the lowest: little-endian, as every browser's typed arrays are.
  const words = new Uint32Array(texels.buffer);
  const packed = new Uint32Array(256);
  channels.forEach((channel, id) => {
    if (channel !== null && id < 256) packed[id] = (0xff << (channel * 8)) >>> 0;
  });
  const perClass = new Float64Array(256);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const classes = tiles[row * columns + column];
      if (classes === null || classes === undefined) continue;
      for (let y = 0; y < TILE; y += 1) {
        const into = (row * TILE + y) * width + column * TILE;
        const from = y * TILE;
        for (let x = 0; x < TILE; x += 1) {
          const id = classes[from + x]!;
          words[into + x] = packed[id]!;
          perClass[id] = perClass[id]! + 1;
        }
      }
    }
  }
  const counts = [0, 0, 0, 0];
  channels.forEach((channel, id) => {
    if (channel !== null && id < 256) counts[channel] = counts[channel]! + perClass[id]!;
  });
  return { width, height, texels, counts };
}

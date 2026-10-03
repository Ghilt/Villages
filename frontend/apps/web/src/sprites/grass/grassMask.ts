import { groundTilt, pixelsPerWorldUnit, toMercatorExact, untiltGround } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { FLAT_MAX_ZOOM, TILE, WORLD_MASTER_WIDTH } from '../../geometry/world';

/**
 * WIP SPIKE: where the grass grows, as the grass shader reads it: the flat tiles of the deepest zoom under the
 * view, pieced into one texture, a byte a world unit, 255 where the ground is grassland and nought elsewhere.
 * The shader softens the edge itself, so nothing here is worked out but a lookup a texel.
 */

/** The flat tiles under the view, at the zoom where a tile pixel is a world unit, inclusive. */
export interface TileRange {
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
}

/** No more tiles than this across or down: further out than that the grass is not drawn anyway. */
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
 * The mask of a range of tiles, given each tile's class ids row by row from the north-west, null for a tile
 * that is not there. Hands back its size in texels, which is its size in world units, and how many of its
 * texels are grass, so a view with none can draw nothing.
 */
export function grassMaskOf(
  range: TileRange,
  tiles: readonly (Uint8Array | null)[],
  grass: ReadonlySet<number>,
): { width: number; height: number; texels: Uint8Array; grassy: number } {
  const columns = range.toX - range.fromX + 1;
  const rows = range.toY - range.fromY + 1;
  const width = columns * TILE;
  const height = rows * TILE;
  const texels = new Uint8Array(width * height);
  const isGrass = new Uint8Array(256);
  for (const id of grass) isGrass[id] = 255;
  let grassy = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const classes = tiles[row * columns + column];
      if (classes === null || classes === undefined) continue;
      for (let y = 0; y < TILE; y += 1) {
        const into = (row * TILE + y) * width + column * TILE;
        const from = y * TILE;
        for (let x = 0; x < TILE; x += 1) {
          const value = isGrass[classes[from + x]!]!;
          texels[into + x] = value;
          if (value !== 0) grassy += 1;
        }
      }
    }
  }
  return { width, height, texels, grassy };
}

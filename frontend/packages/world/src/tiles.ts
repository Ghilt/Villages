import type { ClassRaster } from './raster.ts';

/**
 * Cutting the world into map tiles.
 *
 * The terrain is far too detailed to draw as outlines: tracing thirty-two classes over a world painted at
 * 2.4 kilometres a pixel yields well over a hundred thousand shapes, and the smallest of them, which is
 * most of the lakes, get thrown away by any threshold that keeps the file servable. As pixels it costs
 * nothing, arrives only where the player is looking, and is the form a painterly treatment wants anyway.
 * See docs/adr/0019.
 *
 * Tiles are the usual web map scheme: at zoom z the world is 2^z tiles across and 2^z tall, addressed
 * from the north-west, and each is a square of pixels in Web Mercator.
 */

export const TILE_SIZE = 256;

/** The greatest latitude Mercator can draw, as the fraction of the way down the source image it sits. */
const MERCATOR_EDGE = 85.051129;

export interface TileAddress {
  zoom: number;
  x: number;
  y: number;
}

/**
 * Where a row of a Mercator tile falls in an unprojected image.
 *
 * The master runs linearly in latitude and the map runs linearly in the Mercator projection of it, so
 * every row has to be converted rather than scaled. This is the only real work in tiling.
 */
export function sourceRowFor(tileY: number, rowInTile: number, zoom: number, height: number): number {
  const tiles = 2 ** zoom;
  // How far down the whole Mercator world this row is, from 0 at the top to 1 at the bottom.
  const down = (tileY + (rowInTile + 0.5) / TILE_SIZE) / tiles;
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - 2 * down))) * 180) / Math.PI;
  const clamped = Math.min(MERCATOR_EDGE, Math.max(-MERCATOR_EDGE, latitude));
  const row = ((90 - clamped) / 180) * height;
  return Math.min(height - 1, Math.max(0, Math.floor(row)));
}

/** Where a column of a tile falls in the image. Longitude is linear in both, so this is a scaling. */
export function sourceColumnFor(tileX: number, columnInTile: number, zoom: number, width: number): number {
  const tiles = 2 ** zoom;
  const across = (tileX + (columnInTile + 0.5) / TILE_SIZE) / tiles;
  return Math.min(width - 1, Math.max(0, Math.floor(across * width)));
}

/** How many samples across a tile pixel may take of the master, in each direction. */
const SAMPLE_CAP = 6;

/**
 * One tile of terrain classes.
 *
 * Away from the closest zoom, a tile pixel covers many master pixels, and it takes the class most of them
 * have. Point sampling instead would turn a coast speckled with lakes and fields into noise, because at
 * zoom two each pixel would report one master pixel in sixty-four and report a different one next door.
 * Averaging is not an option either: the mean of two terrains is a third terrain.
 */
export function cutTile(source: ClassRaster, address: TileAddress): ClassRaster {
  const tile: ClassRaster = {
    width: TILE_SIZE,
    height: TILE_SIZE,
    cells: new Uint8Array(TILE_SIZE * TILE_SIZE),
  };

  const tally = new Uint32Array(256);

  for (let row = 0; row < TILE_SIZE; row += 1) {
    const rowFrom = sourceRowFor(address.y, row - 0.5, address.zoom, source.height);
    const rowTo = sourceRowFor(address.y, row + 0.5, address.zoom, source.height);
    const rowStep = Math.max(1, Math.ceil((rowTo - rowFrom + 1) / SAMPLE_CAP));

    for (let column = 0; column < TILE_SIZE; column += 1) {
      const columnFrom = sourceColumnFor(address.x, column - 0.5, address.zoom, source.width);
      const columnTo = sourceColumnFor(address.x, column + 0.5, address.zoom, source.width);

      if (rowTo === rowFrom && columnTo === columnFrom) {
        tile.cells[row * TILE_SIZE + column] = source.cells[rowFrom * source.width + columnFrom]!;
        continue;
      }

      const columnStep = Math.max(1, Math.ceil((columnTo - columnFrom + 1) / SAMPLE_CAP));
      tally.fill(0);
      let best = 0;
      let bestCount = 0;

      for (let y = rowFrom; y <= rowTo; y += rowStep) {
        const line = y * source.width;
        for (let x = columnFrom; x <= columnTo; x += columnStep) {
          const value = source.cells[line + x]!;
          const count = (tally[value] = tally[value]! + 1);
          // Ties go to the lower class, so the same master always gives the same tiles.
          if (count > bestCount || (count === bestCount && value < best)) {
            best = value;
            bestCount = count;
          }
        }
      }

      tile.cells[row * TILE_SIZE + column] = best;
    }
  }

  return tile;
}

/** Every tile address up to and including a zoom, north-west first, which is the order they are wanted. */
export function* tileAddresses(maxZoom: number): Generator<TileAddress> {
  for (let zoom = 0; zoom <= maxZoom; zoom += 1) {
    const tiles = 2 ** zoom;
    for (let y = 0; y < tiles; y += 1) {
      for (let x = 0; x < tiles; x += 1) {
        yield { zoom, x, y };
      }
    }
  }
}

/** How many tiles a zoom range holds, which is worth knowing before writing them all to disk. */
export function tileCount(maxZoom: number): number {
  let total = 0;
  for (let zoom = 0; zoom <= maxZoom; zoom += 1) {
    total += 4 ** zoom;
  }
  return total;
}

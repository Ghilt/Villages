import type { ClassRaster } from './raster.ts';
import { MAX_MERCATOR_LATITUDE } from './sphere.ts';

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

export interface TileAddress {
  zoom: number;
  x: number;
  y: number;
}

/**
 * Where a fraction of the way down the Mercator world falls in an unprojected image, from 0 at the top
 * to 1 at the bottom.
 *
 * The master runs linearly in latitude and the map runs linearly in the Mercator projection of it, so
 * every row has to be converted rather than scaled. This is the only real work in tiling, and it is the
 * whole of it: both ways into the master go through here so that they cannot disagree.
 */
function rowDown(down: number, height: number): number {
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - 2 * down))) * 180) / Math.PI;
  const clamped = Math.min(MAX_MERCATOR_LATITUDE, Math.max(-MAX_MERCATOR_LATITUDE, latitude));
  const row = ((90 - clamped) / 180) * height;
  return Math.min(height - 1, Math.max(0, Math.floor(row)));
}

/** Where a row of a Mercator tile falls in an unprojected image. */
export function sourceRowFor(tileY: number, rowInTile: number, zoom: number, height: number): number {
  return rowDown((tileY + (rowInTile + 0.5) / TILE_SIZE) / 2 ** zoom, height);
}

/**
 * How far down the Mercator world a row of the master sits. The inverse of `rowDown`, and the only one.
 *
 * Null past the edge Mercator can draw: those rows of the master are on no tile at all, so nothing that
 * reads the master through the tiles can answer for them.
 */
function downOfRow(masterRow: number, height: number): number | null {
  const latitude = 90 - ((masterRow + 0.5) / height) * 180;
  if (latitude > MAX_MERCATOR_LATITUDE || latitude < -MAX_MERCATOR_LATITUDE) {
    return null;
  }
  const radians = (latitude * Math.PI) / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI) / 2;
}

/**
 * Where every row of the painterly treatment's world space falls in the master, worked out once.
 *
 * World space is the Mercator square, `worldSize` on a side, which is the master's width, so a world
 * column is a master column already and this is the only direction that has to be projected. The browser
 * gets the conversion for free because it reads Mercator tiles; whatever reads the master instead needs
 * it written down, and this is that. See decision 0030.
 *
 * A table rather than a function of one row, for two reasons. The paint takes nine terrain samples a
 * pixel and a view can be four million pixels, so an `atan` of a `sinh` per sample would cost several
 * times the paint itself. And a whole row is the honest granularity: the browser floors its lookup to a
 * whole tile pixel, and at the zoom the tiles were cut a tile pixel is one world-space unit, so this is
 * the same sampling the map does rather than an approximation of it. Each row is taken at its middle,
 * for the same reason `sourceRowFor` takes one at its middle: a class should come from the centre of the
 * pixel that holds it and not from its top edge.
 */
export function masterRowsAt(worldSize: number, height: number): Int32Array {
  const rows = new Int32Array(worldSize);
  for (let worldY = 0; worldY < worldSize; worldY += 1) {
    rows[worldY] = rowDown((worldY + 0.5) / worldSize, height);
  }
  return rows;
}

/**
 * Which row of the tile grid carries a row of the master: the other way through `rowDown`.
 *
 * `masterRowsAt` goes from the world into the master, which is what anything reading the master needs.
 * This goes the other way, which is what anything reading the master out of the tiles needs, because the
 * tiles are the only copy of it a browser has. Both are `rowDown`, forwards and back, so neither can
 * drift from the tiling. See decision 0032.
 *
 * At the zoom the tiles were cut to it is exact, because Mercator has at least as many rows to a degree
 * as the master everywhere: equal at the equator, and more the further from it. Flooring can land either
 * side of the answer where the two grids share a pitch, so the neighbours are tried before settling.
 * Further out than that zoom several master rows share one tile row, and the nearest is the best that
 * can be said.
 */
export function mercatorRowOf(masterRow: number, height: number, zoom: number): number | null {
  const down = downOfRow(masterRow, height);
  if (down === null) {
    return null;
  }
  const rows = TILE_SIZE * 2 ** zoom;
  const guess = Math.min(rows - 1, Math.max(0, Math.floor(down * rows)));

  for (const row of [guess, guess - 1, guess + 1]) {
    if (row < 0 || row >= rows) {
      continue;
    }
    if (rowDown((row + 0.5) / rows, height) === masterRow) {
      return row;
    }
  }
  return guess;
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

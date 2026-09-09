import { describe, expect, it } from 'vitest';

import { createRaster } from './raster.ts';
import {
  TILE_SIZE,
  cutTile,
  masterRowsAt,
  mercatorRowOf,
  sourceColumnFor,
  sourceRowFor,
  tileAddresses,
  tileCount,
} from './tiles.ts';

describe('finding the source of a tile row', () => {
  const height = 8192;

  it('puts the equator in the middle of the world at zoom zero', () => {
    const middle = sourceRowFor(0, TILE_SIZE / 2, 0, height);

    expect(middle).toBeGreaterThan(height / 2 - height / TILE_SIZE);
    expect(middle).toBeLessThan(height / 2 + height / TILE_SIZE);
  });

  it('runs north to south', () => {
    expect(sourceRowFor(0, 10, 0, height)).toBeLessThan(sourceRowFor(0, 200, 0, height));
  });

  it('stops inside the image at both edges', () => {
    expect(sourceRowFor(0, 0, 0, height)).toBeGreaterThanOrEqual(0);
    expect(sourceRowFor(0, TILE_SIZE - 1, 0, height)).toBeLessThan(height);
  });

  it('stretches the far north, which is what makes Mercator Mercator', () => {
    // The top eighth of the projected world covers far more latitude than the eighth below it.
    const top = sourceRowFor(0, 0, 0, height);
    const eighth = sourceRowFor(0, TILE_SIZE / 8, 0, height);
    const quarter = sourceRowFor(0, TILE_SIZE / 4, 0, height);

    expect(eighth - top).toBeLessThan(quarter - eighth);
  });

  it('reaches nearer the top of the world the closer it zooms', () => {
    // Rows are sampled at their centres, so the first row of the northernmost tile covers less latitude
    // at every zoom and therefore sits nearer the very top of the image.
    const byZoom = [0, 1, 2, 4, 6].map((zoom) => sourceRowFor(0, 0, zoom, height));

    for (let index = 1; index < byZoom.length; index += 1) {
      expect(byZoom[index]!).toBeLessThanOrEqual(byZoom[index - 1]!);
    }
    expect(byZoom.at(-1)!).toBeLessThan(byZoom[0]!);
  });
});

describe('the world space the paint is measured in', () => {
  // The real shape of it: the master is 32768 by 16384 and the tiles were cut at the zoom where a tile
  // pixel is a master pixel, which is seven.
  const width = 32768;
  const height = 16384;
  const cutZoom = 7;
  const masterRowOf = masterRowsAt(width, height);

  /**
   * What the browser's painter passes as `worldY`, from `painterlyWorker.ts`: the tile's own row times
   * `masterPerPixel`, which at the cut zoom is one. Spelled out rather than imported, because importing
   * it from the app would only assert that a line equals itself.
   */
  const workerWorldY = (tileY: number, rowInTile: number, zoom: number): number =>
    (tileY * TILE_SIZE + rowInTile + 0.5) * (width / (TILE_SIZE * 2 ** zoom));

  /** How whatever paints from the master reads it: this table, indexed the way its sampler indexes it. */
  const masterRowAt = (worldY: number): number =>
    masterRowOf[Math.min(width - 1, Math.max(0, Math.floor(worldY)))]!;

  it('is the same space the tiles were cut in, so the offline painter and the map agree', () => {
    // This is the check that matters, and it is exhaustive because it can be: every row of the cut
    // world, the browser's coordinate for it against the master row the tiler took its class from. The
    // offline renderer used to pass an equirectangular row here, which is a different place by a factor
    // of two at sixty degrees north, so the stills were not evidence about the map. See decision 0030.
    // It covers the half a unit too: build the table at the top of each row rather than its middle and
    // 7741 of these 32768 rows read the master row above the one the tiler read.
    for (let tileY = 0; tileY < 2 ** cutZoom; tileY += 1) {
      for (let rowInTile = 0; rowInTile < TILE_SIZE; rowInTile += 1) {
        const worldY = workerWorldY(tileY, rowInTile, cutZoom);

        expect(masterRowAt(worldY)).toBe(sourceRowFor(tileY, rowInTile, cutZoom, height));
      }
    }
  });

  it('is square, so a world unit is the same distance north as it is east', () => {
    // Half way down the square is the equator, and a quarter of the way down is the latitude Mercator
    // puts a quarter of the way down. An equirectangular row would have put the equator a quarter of the
    // way down instead, and made the space an oblong twice as tall on the ground as it is wide.
    expect(masterRowAt(width / 2)).toBe(height / 2);
    expect(masterRowAt(width / 4)).toBeLessThan(height / 4);
  });

  it('stops where Mercator stops, so the rows above that are never painted', () => {
    // Mercator reaches 85 degrees and the master runs to the pole, so the top of the square is already
    // some way down the master and the rows above it are simply never asked for.
    const top = masterRowAt(0);
    const bottom = masterRowAt(width - 1);

    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(height / 32);
    // The square is symmetric about the equator, so what it leaves off the bottom it leaves off the top.
    expect(bottom).toBe(height - 1 - top);
    // Off the square there is no world, so it clamps rather than reading somewhere else.
    expect(masterRowAt(-50)).toBe(top);
    expect(masterRowAt(width + 50)).toBe(bottom);
  });
});

describe('finding a row of the master in the tiles', () => {
  /** The real master, and the zoom it is cut to, because that is the case that has to be exact. */
  const height = 16384;
  const nativeZoom = 7;

  it('reads back as the row it was asked for, at the zoom the tiles were cut to', () => {
    // The tiles are the only copy of the master a browser has, so a row that cannot be found there
    // cannot be counted at all.
    for (const row of [451, 1000, 4000, 8000, 8192, 12000, 15900]) {
      const found = mercatorRowOf(row, height, nativeZoom);

      expect(found).not.toBeNull();
      const tileY = Math.floor(found! / TILE_SIZE);
      expect(sourceRowFor(tileY, found! - tileY * TILE_SIZE, nativeZoom, height)).toBe(row);
    }
  });

  it('has no row at all past the edge Mercator can draw', () => {
    expect(mercatorRowOf(0, height, nativeZoom)).toBeNull();
    expect(mercatorRowOf(height - 1, height, nativeZoom)).toBeNull();
  });

  it('runs north to south, as the rows it is looking for do', () => {
    expect(mercatorRowOf(1000, height, nativeZoom)!).toBeLessThan(mercatorRowOf(9000, height, nativeZoom)!);
  });

  it('gives the nearest row further out, where several rows of the master share one', () => {
    const coarse = mercatorRowOf(4000, height, 2);

    expect(coarse).not.toBeNull();
    expect(coarse!).toBeGreaterThanOrEqual(0);
    expect(coarse!).toBeLessThan(TILE_SIZE * 2 ** 2);
  });

  it('agrees with masterRowsAt, because the two are one conversion run in opposite directions', () => {
    // The table goes from the world into the master and this goes back, and both are `rowDown`. That is
    // the whole reason they cannot drift, and this is what would notice if one of them did.
    const width = TILE_SIZE * 2 ** nativeZoom;
    const table = masterRowsAt(width, height);

    for (const row of [451, 1000, 4000, 8000, 8192, 12000, 15900]) {
      const found = mercatorRowOf(row, height, nativeZoom);

      expect(found).not.toBeNull();
      expect(table[found!]).toBe(row);
    }
  });
});

describe('finding the source of a tile column', () => {
  const width = 16384;

  it('runs west to east across the whole image', () => {
    // Columns are sampled at their centres, so the first and last land half a tile-pixel inside the edges.
    const pixel = width / TILE_SIZE;

    expect(sourceColumnFor(0, 0, 0, width)).toBeLessThan(pixel);
    expect(sourceColumnFor(0, TILE_SIZE - 1, 0, width)).toBeGreaterThan(width - pixel);
  });

  it('puts the prime meridian in the middle', () => {
    const middle = sourceColumnFor(0, TILE_SIZE / 2, 0, width);

    expect(middle).toBeGreaterThan(width / 2 - width / TILE_SIZE);
    expect(middle).toBeLessThan(width / 2 + width / TILE_SIZE);
  });

  it('splits the world in two at zoom one', () => {
    expect(sourceColumnFor(0, TILE_SIZE - 1, 1, width)).toBeLessThan(width / 2);
    expect(sourceColumnFor(1, 0, 1, width)).toBeGreaterThanOrEqual(width / 2);
  });
});

describe('cutting a tile', () => {
  it('is the size a map tile is', () => {
    const source = createRaster(64, 32, 7);
    const tile = cutTile(source, { zoom: 0, x: 0, y: 0 });

    expect(tile.width).toBe(TILE_SIZE);
    expect(tile.height).toBe(TILE_SIZE);
  });

  it('carries the classes that were there, and invents none', () => {
    const source = createRaster(64, 32, 7);
    source.cells.fill(9, 0, 64 * 8);
    const tile = cutTile(source, { zoom: 0, x: 0, y: 0 });

    expect([...new Set(tile.cells)].sort()).toEqual([7, 9]);
  });

  it('takes a different part of the world for a different tile', () => {
    const source = createRaster(64, 32);
    for (let y = 0; y < 32; y += 1) {
      source.cells.fill(y < 16 ? 1 : 2, y * 64, (y + 1) * 64);
    }
    const north = cutTile(source, { zoom: 1, x: 0, y: 0 });
    const south = cutTile(source, { zoom: 1, x: 0, y: 1 });

    expect(north.cells[0]).toBe(1);
    expect(south.cells[TILE_SIZE * TILE_SIZE - 1]).toBe(2);
  });
});

describe('the tiles of a world', () => {
  it('counts them the way a pyramid counts', () => {
    expect(tileCount(0)).toBe(1);
    expect(tileCount(1)).toBe(5);
    expect(tileCount(2)).toBe(21);
    expect(tileCount(6)).toBe(5461);
  });

  it('lists every one of them exactly once', () => {
    const seen = new Set<string>();
    for (const address of tileAddresses(3)) {
      seen.add(`${address.zoom}/${address.x}/${address.y}`);
    }

    expect(seen.size).toBe(tileCount(3));
  });

  it('starts at the whole world and works down', () => {
    const [first] = [...tileAddresses(2)];

    expect(first).toEqual({ zoom: 0, x: 0, y: 0 });
  });
});

describe('sampling a tile away from the closest zoom', () => {
  /** A world striped so that one class is in the clear majority of any block. */
  function striped(width: number, height: number): ReturnType<typeof createRaster> {
    const raster = createRaster(width, height, 5);
    for (let index = 0; index < raster.cells.length; index += 7) {
      raster.cells[index] = 9;
    }
    return raster;
  }

  it('takes the class most of the block has, not whichever pixel it landed on', () => {
    const tile = cutTile(striped(4096, 2048), { zoom: 0, x: 0, y: 0 });

    // One pixel in seven is class 9, so a block of many should read as class 5 everywhere.
    expect([...new Set(tile.cells)]).toEqual([5]);
  });

  it('keeps fine detail where a tile pixel is about a master pixel', () => {
    // A band across the middle: whichever rows Mercator lands on, it cannot be averaged away.
    const source = createRaster(TILE_SIZE, TILE_SIZE, 3);
    for (let y = 120; y < 136; y += 1) {
      source.cells.fill(8, y * TILE_SIZE, (y + 1) * TILE_SIZE);
    }
    const tile = cutTile(source, { zoom: 0, x: 0, y: 0 });

    expect([...tile.cells]).toContain(8);
  });

  it('gives the same tiles from the same world every time', () => {
    const source = striped(2048, 1024);
    const once = cutTile(source, { zoom: 1, x: 1, y: 0 });
    const twice = cutTile(source, { zoom: 1, x: 1, y: 0 });

    expect([...once.cells]).toEqual([...twice.cells]);
  });

  it('keeps a large region whole rather than dissolving it', () => {
    const source = createRaster(2048, 1024, 0);
    for (let y = 200; y < 400; y += 1) {
      source.cells.fill(4, y * 2048 + 400, y * 2048 + 900);
    }
    const tile = cutTile(source, { zoom: 0, x: 0, y: 0 });

    expect([...tile.cells].filter((value) => value === 4).length).toBeGreaterThan(100);
  });
});

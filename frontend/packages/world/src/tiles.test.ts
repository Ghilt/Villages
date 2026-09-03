import { describe, expect, it } from 'vitest';

import { createRaster } from './raster.ts';
import { TILE_SIZE, cutTile, sourceColumnFor, sourceRowFor, tileAddresses, tileCount } from './tiles.ts';

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

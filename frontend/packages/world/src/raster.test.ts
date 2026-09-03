import { describe, expect, it } from 'vitest';

import {
  classAt,
  classHistogram,
  createRaster,
  fillPolygon,
  strokeLine,
  toLngLat,
  toPixel,
} from './raster.ts';
import type { Ring } from './raster.ts';

const box = (west: number, south: number, east: number, north: number): Ring => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
];

describe('the grid', () => {
  const raster = { width: 360, height: 180 };

  it('puts the prime meridian and the equator in the middle', () => {
    expect(toPixel({ lng: 0, lat: 0 }, raster)).toEqual({ x: 180, y: 90 });
  });

  it('runs west to east and north to south, as an image does', () => {
    expect(toPixel({ lng: -180, lat: 90 }, raster)).toEqual({ x: 0, y: 0 });
    expect(toPixel({ lng: 180, lat: -90 }, raster)).toEqual({ x: 360, y: 180 });
  });

  it('gives back the middle of a pixel', () => {
    const place = toLngLat(180, 90, raster);
    expect(place.lng).toBeCloseTo(0.5, 9);
    expect(place.lat).toBeCloseTo(-0.5, 9);
  });

  it('round-trips a place through its pixel', () => {
    const start = { lng: 18.4, lat: 57.6 };
    const { x, y } = toPixel(start, raster);
    const back = toLngLat(Math.floor(x), Math.floor(y), raster);

    expect(back.lng).toBeCloseTo(start.lng, 0);
    expect(back.lat).toBeCloseTo(start.lat, 0);
  });
});

describe('painting a polygon', () => {
  it('fills a rectangle and leaves the sea alone', () => {
    const raster = createRaster(360, 180);
    fillPolygon(raster, [box(-10, -10, 10, 10)], 6);

    expect(classAt(raster, { lng: 0, lat: 0 })).toBe(6);
    expect(classAt(raster, { lng: 40, lat: 0 })).toBe(0);
    expect(classAt(raster, { lng: 0, lat: 40 })).toBe(0);
  });

  it('covers about the area it should', () => {
    const raster = createRaster(360, 180);
    fillPolygon(raster, [box(-30, -20, 30, 20)], 8);

    // Sixty degrees by forty, on a grid of one degree per pixel.
    expect(classHistogram(raster).get(8)).toBeCloseTo(60 * 40, -2);
  });

  it('leaves a hole where a ring sits inside another', () => {
    const raster = createRaster(360, 180);
    fillPolygon(raster, [box(-20, -20, 20, 20), box(-5, -5, 5, 5)], 5);

    expect(classAt(raster, { lng: 12, lat: 0 })).toBe(5);
    expect(classAt(raster, { lng: 0, lat: 0 })).toBe(0);
  });

  it('paints later over earlier, so that a lake can sit on a forest', () => {
    const raster = createRaster(360, 180);
    fillPolygon(raster, [box(-20, -20, 20, 20)], 6);
    fillPolygon(raster, [box(-5, -5, 5, 5)], 1);

    expect(classAt(raster, { lng: 0, lat: 0 })).toBe(1);
    expect(classAt(raster, { lng: 12, lat: 0 })).toBe(6);
  });

  it('clips a shape that runs off the edge of the world', () => {
    const raster = createRaster(360, 180);
    fillPolygon(raster, [box(-200, 80, -160, 100)], 3);

    expect(classAt(raster, { lng: -179, lat: 89 })).toBe(3);
    expect(raster.cells.length).toBe(360 * 180);
  });

  it('paints a triangle, which no rectangle test would catch', () => {
    const raster = createRaster(360, 180);
    fillPolygon(
      raster,
      [
        [
          [-20, -20],
          [20, -20],
          [0, 20],
        ],
      ],
      9,
    );

    expect(classAt(raster, { lng: 0, lat: -15 })).toBe(9);
    expect(classAt(raster, { lng: -18, lat: 18 })).toBe(0);
  });

  it('does nothing with a degenerate ring rather than throwing', () => {
    const raster = createRaster(36, 18);
    fillPolygon(raster, [[[0, 0]]], 4);
    fillPolygon(raster, [[]], 4);

    expect(classHistogram(raster).get(4)).toBeUndefined();
  });
});

describe('drawing a river', () => {
  it('leaves a mark a pixel wide where a fill would leave nothing', () => {
    const raster = createRaster(360, 180);
    strokeLine(
      raster,
      [
        [-20, 0],
        [20, 0],
      ],
      2,
      1,
    );

    expect(classAt(raster, { lng: 0, lat: 0 })).toBe(2);
    expect(classAt(raster, { lng: 0, lat: 5 })).toBe(0);
  });

  it('widens on request, so that a river survives being looked at', () => {
    const thin = createRaster(360, 180);
    const thick = createRaster(360, 180);
    const path: Ring = [
      [-20, 0],
      [20, 0],
    ];
    strokeLine(thin, path, 2, 1);
    strokeLine(thick, path, 2, 3);

    expect(classHistogram(thick).get(2)!).toBeGreaterThan(classHistogram(thin).get(2)!);
  });

  it('follows a bend', () => {
    const raster = createRaster(360, 180);
    strokeLine(
      raster,
      [
        [-30, -20],
        [0, 0],
        [30, -20],
      ],
      2,
      1,
    );

    expect(classAt(raster, { lng: 0, lat: 0 })).toBe(2);
    expect(classAt(raster, { lng: -15, lat: -10 })).toBe(2);
  });

  it('stays inside the world when a path runs off it', () => {
    const raster = createRaster(36, 18);
    strokeLine(
      raster,
      [
        [-200, 0],
        [200, 0],
      ],
      2,
      3,
    );

    expect(raster.cells.length).toBe(36 * 18);
  });
});

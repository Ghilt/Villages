import { describe, expect, it } from 'vitest';

import { createRaster, fillPolygon } from './raster.ts';
import { toLngLat, traceClass } from './trace.ts';
import type { Ring } from './trace.ts';

/** A raster written out as characters, which is the only readable way to test a shape. */
function paint(rows: string[]): ReturnType<typeof createRaster> {
  const raster = createRaster(rows[0]!.length, rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((mark, x) => {
      raster.cells[y * raster.width + x] = mark === '.' ? 0 : Number.parseInt(mark, 10);
    });
  });
  return raster;
}

const isClosed = (ring: Ring): boolean =>
  ring.length > 3 && ring[0]!.x === ring.at(-1)!.x && ring[0]!.y === ring.at(-1)!.y;

/** Twice the signed area, which is positive or negative by winding and zero only for a degenerate ring. */
function doubleArea(ring: Ring): number {
  let sum = 0;
  for (let index = 0; index + 1 < ring.length; index += 1) {
    sum += ring[index]!.x * ring[index + 1]!.y - ring[index + 1]!.x * ring[index]!.y;
  }
  return sum;
}

describe('tracing a shape', () => {
  it('draws a square around a single pixel', () => {
    const rings = [...traceClass(paint(['...', '.1.', '...']), 1)];

    expect(rings).toHaveLength(1);
    expect(isClosed(rings[0]!)).toBe(true);
    expect(Math.abs(doubleArea(rings[0]!)) / 2).toBeCloseTo(1, 9);
  });

  it('draws one ring around a block, not one per pixel', () => {
    const rings = [...traceClass(paint(['.....', '.111.', '.111.', '.....']), 1)];

    expect(rings).toHaveLength(1);
    expect(Math.abs(doubleArea(rings[0]!)) / 2).toBeCloseTo(6, 9);
  });

  it('finds two rings for two separate islands', () => {
    const rings = [...traceClass(paint(['.......', '.1...1.', '.......']), 1)];

    expect(rings).toHaveLength(2);
    expect(rings.every(isClosed)).toBe(true);
  });

  it('finds the hole in a ring as its own outline', () => {
    const rings = [...traceClass(paint(['.....', '.111.', '.1.1.', '.111.', '.....']), 1)];

    expect(rings).toHaveLength(2);
    const areas = rings.map((ring) => Math.abs(doubleArea(ring)) / 2).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(1, 9);
    expect(areas[1]).toBeCloseTo(9, 9);
  });

  it('winds a hole against its outline, so that one can be told from the other', () => {
    const rings = [...traceClass(paint(['.....', '.111.', '.1.1.', '.111.', '.....']), 1)];
    const [outer, inner] = rings.sort((a, b) => Math.abs(doubleArea(b)) - Math.abs(doubleArea(a)));

    expect(Math.sign(doubleArea(outer!))).not.toBe(Math.sign(doubleArea(inner!)));
  });

  it('closes off land that runs past the edge of the world', () => {
    const rings = [...traceClass(paint(['11..', '11..', '....']), 1)];

    expect(rings).toHaveLength(1);
    expect(isClosed(rings[0]!)).toBe(true);
    expect(Math.abs(doubleArea(rings[0]!)) / 2).toBeCloseTo(4, 9);
  });

  it('follows a diagonal without breaking the ring', () => {
    const rings = [...traceClass(paint(['1....', '.1...', '..1..', '...1.']), 1)].filter(isClosed);

    expect(rings.length).toBeGreaterThan(0);
  });

  it('traces each class separately, and their shared border only once each', () => {
    const raster = paint(['1122', '1122', '1122']);

    const ones = [...traceClass(raster, 1)];
    const twos = [...traceClass(raster, 2)];

    expect(ones).toHaveLength(1);
    expect(twos).toHaveLength(1);
    expect(Math.abs(doubleArea(ones[0]!)) / 2).toBeCloseTo(6, 9);
    expect(Math.abs(doubleArea(twos[0]!)) / 2).toBeCloseTo(6, 9);
  });

  it('finds nothing for a class nobody painted', () => {
    expect([...traceClass(paint(['....', '....']), 7)]).toHaveLength(0);
  });

  it('traces a shape that was filled rather than typed', () => {
    const raster = createRaster(64, 32);
    fillPolygon(
      raster,
      [
        [
          [-40, -20],
          [40, -20],
          [40, 20],
          [-40, 20],
        ],
      ],
      3,
    );
    const rings = [...traceClass(raster, 3)];

    expect(rings).toHaveLength(1);
    expect(isClosed(rings[0]!)).toBe(true);
  });
});

describe('putting an outline back on the world', () => {
  it('sends the corners of the lattice to the corners of the world', () => {
    const raster = { width: 360, height: 180 };

    expect(toLngLat({ x: 0, y: 0 }, raster)).toEqual([-180, 90]);
    expect(toLngLat({ x: 360, y: 180 }, raster)).toEqual([180, -90]);
    expect(toLngLat({ x: 180, y: 90 }, raster)).toEqual([0, 0]);
  });
});

import { describe, expect, it } from 'vitest';

import { fromTerrarium, halve, heightAt, levelFor, toTerrarium, undoFloatPredictor } from './height.ts';
import type { HeightGrid } from './height.ts';

const grid = (width: number, height: number, values: number[]): HeightGrid => ({
  width,
  height,
  west: 0,
  north: 10,
  cell: 1,
  heights: Float32Array.from(values),
});

describe('Terrarium', () => {
  it('round-trips a height to the metre, from the sea floor to Everest', () => {
    const bytes = new Uint8Array(3);
    for (const metres of [-10935, -1, 0, 1, 255, 256, 4808, 8848]) {
      toTerrarium(metres, bytes, 0);
      expect(fromTerrarium(bytes[0]!, bytes[1]!, bytes[2]!)).toBe(metres);
      expect(bytes[2]).toBe(0);
    }
  });

  it('rounds a fraction of a metre away rather than keeping it in blue', () => {
    const bytes = new Uint8Array(3);
    toTerrarium(4807.6, bytes, 0);
    expect(fromTerrarium(bytes[0]!, bytes[1]!, bytes[2]!)).toBe(4808);
  });
});

describe('the floating-point predictor', () => {
  it('gives back the floats it was written from', () => {
    const floats = [0, 1.5, -320.25, 4808, -10935.5];
    const samples = floats.length;
    // Written the way TIFF writes it: big-endian byte planes, then each byte less the one before it.
    const planes = new Uint8Array(samples * 4);
    const word = new DataView(new ArrayBuffer(4));
    floats.forEach((value, j) => {
      word.setFloat32(0, value);
      for (let k = 0; k < 4; k += 1) planes[k * samples + j] = word.getUint8(k);
    });
    const differenced = planes.map((byte, i) => (i === 0 ? byte : (byte - planes[i - 1]! + 256) & 255));

    const into = new Float32Array(samples + 2);
    undoFloatPredictor(differenced, samples, into, 2);
    expect(Array.from(into.subarray(2))).toEqual(floats);
  });
});

describe('a height grid', () => {
  it('halves by the mean of four', () => {
    const half = halve(grid(4, 2, [0, 4, 10, 10, 8, 4, 20, 0]));
    expect(half.width).toBe(2);
    expect(half.height).toBe(1);
    expect(half.cell).toBe(2);
    expect(Array.from(half.heights)).toEqual([4, 10]);
  });

  it('reads a cell middle exactly and halfway between two as their mean', () => {
    const g = grid(2, 1, [100, 300]);
    expect(heightAt(g, 0.5, 9.5)).toBe(100);
    expect(heightAt(g, 1.5, 9.5)).toBe(300);
    expect(heightAt(g, 1, 9.5)).toBe(200);
  });

  it('keeps the edge value past the edge rather than reading outside', () => {
    const g = grid(2, 1, [100, 300]);
    expect(heightAt(g, -5, 9.5)).toBe(100);
    expect(heightAt(g, 50, 0)).toBe(300);
  });

  it('carries a whole world round the antimeridian rather than holding its edge', () => {
    const world: HeightGrid = {
      width: 4,
      height: 1,
      west: -180,
      north: 10,
      cell: 90,
      heights: Float32Array.from([100, 0, 0, 300]),
    };
    // Halfway between the last column's middle and the first's, across 180 degrees.
    expect(heightAt(world, 180, 5)).toBe(200);
    expect(heightAt(world, -180, 5)).toBe(200);
    expect(heightAt(world, 135, 5)).toBe(300);
  });

  it('picks the pyramid level whose cell is nearest a pixel without being wider', () => {
    expect(levelFor(0.5, 1, 9)).toBe(0);
    expect(levelFor(1.9, 1, 9)).toBe(0);
    expect(levelFor(2, 1, 9)).toBe(1);
    expect(levelFor(5.3, 1, 9)).toBe(2);
    expect(levelFor(10_000, 1, 9)).toBe(8);
  });
});

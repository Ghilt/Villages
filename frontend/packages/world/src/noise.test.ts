import { describe, expect, it } from 'vitest';

import { noiseAt } from './noise.ts';

const field = { cellsX: 12, cellsY: 6, seed: 20260902 };

describe('the wobble', () => {
  it('stays inside its range', () => {
    for (let lng = -180; lng <= 180; lng += 3.7) {
      for (let lat = -85; lat <= 85; lat += 7.3) {
        const value = noiseAt(lng, lat, field);
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives the same world every time from the same seed', () => {
    expect(noiseAt(11.3, 47.2, field)).toBe(noiseAt(11.3, 47.2, field));
    expect(noiseAt(11.3, 47.2, { ...field, seed: field.seed + 1 })).not.toBe(noiseAt(11.3, 47.2, field));
  });

  it('varies from place to place', () => {
    const samples = new Set<number>();
    for (let lng = -170; lng < 170; lng += 17) {
      samples.add(Number(noiseAt(lng, 40, field).toFixed(6)));
    }
    expect(samples.size).toBeGreaterThan(5);
  });

  it('changes smoothly, so a coastline does not jump', () => {
    const here = noiseAt(20, 50, field);
    const nudged = noiseAt(20.01, 50, field);

    expect(Math.abs(nudged - here)).toBeLessThan(0.02);
  });

  it('joins up at the antimeridian', () => {
    expect(noiseAt(180, 40, field)).toBeCloseTo(noiseAt(-180, 40, field), 9);
  });

  it('separates its channels', () => {
    expect(noiseAt(20, 50, field, 0)).not.toBeCloseTo(noiseAt(20, 50, field, 1), 3);
  });
});

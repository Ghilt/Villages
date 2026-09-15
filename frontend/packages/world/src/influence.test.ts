import { describe, expect, it } from 'vitest';

import { fenceSize, fenceWindow, insideFence } from './area.ts';
import { influenceZoneAround } from './influence.ts';
import { toPixel } from './raster.ts';

/** The master's own grid, which is what a fence is measured in. */
const grid = { width: 32768, height: 16384 };

const stockholm = { lng: 18.07, lat: 59.33 };
const equator = { lng: 0, lat: 0 };

describe('the ground a house holds about its seat', () => {
  it('encloses the seat itself', () => {
    const fence = influenceZoneAround(stockholm, grid, 20);
    const at = toPixel(stockholm, grid);

    expect(insideFence(fence, Math.floor(at.x), Math.floor(at.y))).toBe(true);
  });

  it('is one piece, with nothing missing out of the middle of it', () => {
    const fence = influenceZoneAround(stockholm, grid, 20);

    expect(fence.parts).toHaveLength(1);
    expect(fence.parts[0]!.holes).toHaveLength(0);
  });

  it('holds about as many pixels as a circle of that reach does', () => {
    const reach = 30;
    const fence = influenceZoneAround(stockholm, grid, reach);

    // Within a tenth of pi r squared: the rest is the staircase the lattice makes of a curve.
    const circle = Math.PI * reach * reach;
    expect(fenceSize(fence)).toBeGreaterThan(circle * 0.9);
    expect(fenceSize(fence)).toBeLessThan(circle * 1.1);
  });

  it('is as wide as it is tall, because it is round on the master rather than in degrees', () => {
    const window = fenceWindow(influenceZoneAround(stockholm, grid, 25));

    expect(Math.abs(window.width - window.height)).toBeLessThanOrEqual(1);
  });

  it('is the same size wherever the house is, north or on the equator', () => {
    const north = fenceSize(influenceZoneAround(stockholm, grid, 25));
    const middle = fenceSize(influenceZoneAround(equator, grid, 25));

    // Within a percent: what differs is where the staircase falls, not how much ground there is.
    expect(Math.abs(north - middle) / middle).toBeLessThan(0.02);
  });

  it('grows with the reach', () => {
    const small = fenceSize(influenceZoneAround(equator, grid, 10));
    const large = fenceSize(influenceZoneAround(equator, grid, 20));

    expect(large).toBeGreaterThan(small * 3);
  });

  it('refuses a reach that would swallow the world rather than allocating one', () => {
    expect(() => influenceZoneAround(equator, grid, 100_000)).toThrow();
  });
});

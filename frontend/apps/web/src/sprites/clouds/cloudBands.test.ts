import { describe, expect, it } from 'vitest';

import { cloudBandAt, orderedZooms } from './cloudBands';

const ZOOMS = { inFrom: 7, overFrom: 6, fadeFrom: 5.25, goneAt: 4.5 };

describe('the clouds by zoom', () => {
  it('draws nothing under them, closer in than 7', () => {
    for (const zoom of [7, 7.5, 8.5, 10]) {
      expect(cloudBandAt(zoom, ZOOMS)).toEqual({ name: 'under', clouds: 0, shadows: 0 });
    }
  });

  it('draws nothing past 4.5, where the whole world reads', () => {
    for (const zoom of [4.5, 4, 2, -1]) {
      expect(cloudBandAt(zoom, ZOOMS)).toEqual({ name: 'gone', clouds: 0, shadows: 0 });
    }
  });

  it('draws them whole over the clouds, from 6 out to 5.25', () => {
    for (const zoom of [6, 5.8, 5.5, 5.25]) {
      expect(cloudBandAt(zoom, ZOOMS)).toEqual({ name: 'over', clouds: 1, shadows: 1 });
    }
  });

  it('fades them between 5.25 and 4.5, and in the clouds between 6 and 7', () => {
    expect(cloudBandAt(4.875, ZOOMS)).toEqual({ name: 'fading', clouds: 0.5, shadows: 0.5 });
    expect(cloudBandAt(6.5, ZOOMS)).toEqual({ name: 'in', clouds: 0.5, shadows: 0.5 });
  });

  it('never jumps: a thousandth of a zoom moves them by a hundredth at most', () => {
    let was = cloudBandAt(3, ZOOMS);
    for (let zoom = 3; zoom <= 9; zoom += 0.001) {
      const now = cloudBandAt(zoom, ZOOMS);
      for (const part of ['clouds', 'shadows'] as const) {
        expect(Math.abs(now[part] - was[part])).toBeLessThan(0.01);
        expect(now[part]).toBeGreaterThanOrEqual(0);
        expect(now[part]).toBeLessThanOrEqual(1);
      }
      was = now;
    }
  });

  it('keeps the edges in order whatever order the sliders were left in', () => {
    const crossed = { inFrom: 6, overFrom: 6.5, fadeFrom: 7, goneAt: 4 };
    expect(orderedZooms(crossed)).toEqual({ inFrom: 6, overFrom: 6, fadeFrom: 6, goneAt: 4 });
    for (let zoom = 3; zoom <= 8; zoom += 0.01) {
      const { clouds } = cloudBandAt(zoom, crossed);
      expect(Number.isFinite(clouds)).toBe(true);
      expect(clouds).toBeGreaterThanOrEqual(0);
      expect(clouds).toBeLessThanOrEqual(1);
    }
  });
});

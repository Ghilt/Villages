import { describe, expect, it } from 'vitest';

import { SWELL, cloudBandAt, orderedZooms } from './cloudBands';
import type { CloudBand } from './cloudBands';

const ZOOMS = { inFrom: 7, overFrom: 6, fadeFrom: 5.25, goneAt: 4.5 };

const PARTS = [
  'clouds',
  'shadows',
  'inside',
  'magnification',
] as const satisfies readonly (keyof CloudBand)[];

describe('the clouds by zoom', () => {
  it('draws nothing under them, closer in than 7', () => {
    for (const zoom of [7, 7.5, 8.5, 10]) {
      const band = cloudBandAt(zoom, ZOOMS);
      expect(band.name).toBe('under');
      expect(band.clouds).toBe(0);
      expect(band.shadows).toBe(0);
    }
  });

  it('draws nothing past 4.5, where the whole world reads', () => {
    for (const zoom of [4.5, 4, 2, -1]) {
      expect(cloudBandAt(zoom, ZOOMS)).toEqual({
        name: 'gone',
        clouds: 0,
        shadows: 0,
        inside: 0,
        magnification: 1,
      });
    }
  });

  it('draws them whole over the clouds, from 6 out to 5.25, glued to the ground', () => {
    for (const zoom of [6, 5.8, 5.5, 5.25]) {
      expect(cloudBandAt(zoom, ZOOMS)).toEqual({
        name: 'over',
        clouds: 1,
        shadows: 1,
        inside: 0,
        magnification: 1,
      });
    }
  });

  it('fades them between 5.25 and 4.5, still glued to the ground', () => {
    expect(cloudBandAt(4.875, ZOOMS)).toEqual({
      name: 'fading',
      clouds: 0.5,
      shadows: 0.5,
      inside: 0,
      magnification: 1,
    });
  });

  it('swells them about the middle in the clouds, more the closer the camera comes', () => {
    const a = cloudBandAt(6.25, ZOOMS);
    const b = cloudBandAt(6.5, ZOOMS);
    const c = cloudBandAt(6.9, ZOOMS);
    expect(a.name).toBe('in');
    expect(a.magnification).toBeGreaterThan(1);
    expect(b.magnification).toBeGreaterThan(a.magnification);
    expect(c.magnification).toBeGreaterThan(b.magnification);
    expect(c.magnification).toBeLessThan(SWELL);
    // The clouds stay whole most of the way in, and their shadows go first.
    expect(b.clouds).toBe(1);
    expect(b.shadows).toBeLessThan(1);
    expect(c.clouds).toBeLessThan(1);
  });

  it('never jumps: a thousandth of a zoom moves anything by a hundredth at most, the swelling by two', () => {
    let was = cloudBandAt(3, ZOOMS);
    for (let zoom = 3; zoom <= 9; zoom += 0.001) {
      const now = cloudBandAt(zoom, ZOOMS);
      for (const part of PARTS) {
        expect(Math.abs(now[part] - was[part])).toBeLessThan(part === 'magnification' ? 0.02 : 0.01);
      }
      for (const part of ['clouds', 'shadows', 'inside'] as const) {
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
      const band = cloudBandAt(zoom, crossed);
      for (const part of PARTS) {
        expect(Number.isFinite(band[part])).toBe(true);
      }
      expect(band.clouds).toBeGreaterThanOrEqual(0);
      expect(band.clouds).toBeLessThanOrEqual(1);
    }
  });
});

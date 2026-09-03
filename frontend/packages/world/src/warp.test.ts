import { describe, expect, it } from 'vitest';

import { angularDistance } from './sphere.ts';
import { controlOffset, seamDamping, warpPoint } from './warp.ts';
import type { WarpConfig } from './warp.ts';

const QUIET: WarpConfig = {
  rotation: { yaw: 0, pitch: 0, roll: 0 },
  controls: [],
  noise: { cellsX: 12, cellsY: 6, seed: 1, amplitude: 0 },
  seamGuard: 0,
  maxLatitude: 85,
};

const ONE_PULL: WarpConfig = {
  ...QUIET,
  controls: [{ lng: 10, lat: 55, radius: 12, dLng: 6, dLat: -4 }],
};

describe('the seam guard', () => {
  it('lets the middle of the map move freely', () => {
    expect(seamDamping(0, 20)).toBe(1);
    expect(seamDamping(-140, 20)).toBe(1);
  });

  it('holds the antimeridian still, so no coastline is carried across it', () => {
    expect(seamDamping(180, 20)).toBe(0);
    expect(seamDamping(-180, 20)).toBe(0);
    expect(seamDamping(170, 20)).toBeCloseTo(0.5, 9);
  });

  it('does nothing when it is switched off', () => {
    expect(seamDamping(180, 0)).toBe(1);
  });
});

describe('the pull of a control', () => {
  it('is strongest at the control itself', () => {
    const atControl = controlOffset({ lng: 10, lat: 55 }, ONE_PULL.controls);

    expect(atControl.dLng).toBeCloseTo(6, 6);
    expect(atControl.dLat).toBeCloseTo(-4, 6);
  });

  it('fades to nothing far away', () => {
    const faraway = controlOffset({ lng: -150, lat: -30 }, ONE_PULL.controls);

    expect(Math.abs(faraway.dLng)).toBeLessThan(0.0001);
    expect(Math.abs(faraway.dLat)).toBeLessThan(0.0001);
  });

  it('adds up where controls overlap', () => {
    const both = controlOffset({ lng: 10, lat: 55 }, [
      { lng: 10, lat: 55, radius: 12, dLng: 3, dLat: 0 },
      { lng: 10, lat: 55, radius: 12, dLng: 2, dLat: 0 },
    ]);

    expect(both.dLng).toBeCloseTo(5, 6);
  });
});

describe('warping a place', () => {
  it('leaves the world alone when nothing is configured', () => {
    const place = { lng: 18.0686, lat: 59.3293 };
    const warped = warpPoint(place, QUIET);

    expect(warped.lng).toBeCloseTo(place.lng, 9);
    expect(warped.lat).toBeCloseTo(place.lat, 9);
  });

  it('drags a place towards where its control points', () => {
    const warped = warpPoint({ lng: 10, lat: 55 }, ONE_PULL);

    expect(warped.lng).toBeCloseTo(16, 4);
    expect(warped.lat).toBeCloseTo(51, 4);
  });

  it('keeps neighbours neighbours, which is what stops a coastline tearing', () => {
    const a = { lng: 9.9, lat: 55 };
    const b = { lng: 10.1, lat: 55 };

    const before = angularDistance(a, b);
    const after = angularDistance(warpPoint(a, ONE_PULL), warpPoint(b, ONE_PULL));

    expect(after).toBeLessThan(before * 3);
    expect(after).toBeGreaterThan(before / 3);
  });

  it('never leaves what Mercator can draw', () => {
    const wild: WarpConfig = {
      ...QUIET,
      controls: [{ lng: 0, lat: 80, radius: 90, dLng: 300, dLat: 300 }],
      noise: { cellsX: 12, cellsY: 6, seed: 3, amplitude: 40 },
    };

    for (let lng = -180; lng <= 180; lng += 11) {
      for (let lat = -85; lat <= 85; lat += 11) {
        const warped = warpPoint({ lng, lat }, wild);
        expect(Math.abs(warped.lng)).toBeLessThanOrEqual(180);
        expect(Math.abs(warped.lat)).toBeLessThanOrEqual(wild.maxLatitude);
      }
    }
  });
});

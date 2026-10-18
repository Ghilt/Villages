import { describe, expect, it } from 'vitest';
import { GROUND_LATTICE, alongU, alongV, frameOf } from '@villages/world';

import { toMercator } from './cameraMath';
import { onACorner } from './footing';
import { WORLD_MASTER_WIDTH } from './world';

const FRAME = frameOf(GROUND_LATTICE);

/** A place in world units, where the lattice is measured. */
function inUnits(place: { lng: number; lat: number }) {
  const mercator = toMercator(place);
  return { x: mercator.x * WORLD_MASTER_WIDTH, y: mercator.y * WORLD_MASTER_WIDTH };
}

describe("a building's foot on the diamonds", () => {
  const places = [
    { lng: 18.07, lat: 59.33 },
    { lng: -77.4, lat: -78.4 },
    { lng: 151.21, lat: -33.87 },
    { lng: 0.0001, lat: 0.0001 },
  ];

  it('stands on a corner of the ground lattice, less than a world unit from its place', () => {
    for (const place of places) {
      const foot = inUnits(onACorner(place));
      const u = alongU(FRAME, foot.x, foot.y);
      const v = alongV(FRAME, foot.x, foot.y);
      expect(Math.abs(u - Math.round(u))).toBeLessThan(1e-6);
      expect(Math.abs(v - Math.round(v))).toBeLessThan(1e-6);

      const from = inUnits(place);
      expect(Math.hypot(foot.x - from.x, foot.y - from.y)).toBeLessThanOrEqual(Math.SQRT1_2 + 1e-9);
    }
  });

  it('stays where it is put, so a building never creeps as it is drawn again', () => {
    for (const place of places) {
      const once = onACorner(place);
      const twice = onACorner(once);
      expect(twice.lng).toBeCloseTo(once.lng, 9);
      expect(twice.lat).toBeCloseTo(once.lat, 9);
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { CoverageCircle, VisionPointView } from '@villages/protocol';

import coverage from '../../../../../contracts/fixtures/coverage.json?raw';
import { WORLD_MASTER_WIDTH } from '../map/worldStyle';
import { toMercator } from '../sprites/cameraMath';

import { circleOf } from './circles';
import type { FogCircle } from './circles';
import { MOST_TEXELS, REACH, fieldOf } from './fogField';
import type { FogField } from './fogField';

/** The two distances of the texel a point of world space falls in: to revealed ground, and to vision. */
function at(field: FogField, x: number, y: number): { revealed: number; vision: number } {
  const column = Math.floor((x - field.originX) / field.unitsPerTexel);
  const row = Math.floor((y - field.originY) / field.unitsPerTexel);
  if (column < 0 || row < 0 || column >= field.width || row >= field.height) {
    return { revealed: REACH, vision: REACH };
  }
  const index = (row * field.width + column) * 2;
  return { revealed: field.distances[index]!, vision: field.distances[index + 1]! };
}

const seat: FogCircle = { x: 17_000, y: 9_000, radius: 50, grown: 50, lasting: true };

describe('the distance field the fog is drawn from', () => {
  it('is nothing at all for a house with nothing to see from', () => {
    expect(fieldOf([])).toBeNull();
  });

  it('is negative inside a circle, near nought on its edge and as far as it ever says outside', () => {
    const field = fieldOf([seat])!;

    expect(at(field, 17_000, 9_000).revealed).toBeCloseTo(-49.3, 1);
    expect(Math.abs(at(field, 17_050, 9_000).revealed)).toBeLessThan(1);
    expect(at(field, 17_000 + 50 + REACH - 1, 9_000).revealed).toBeGreaterThan(REACH - 2);
    expect(at(field, 16_000, 8_000)).toEqual({ revealed: REACH, vision: REACH });
  });

  it('covers the circles and a reach around them, one texel a world unit', () => {
    const field = fieldOf([seat])!;

    expect(field.originX).toBe(17_000 - 50 - REACH);
    expect(field.originY).toBe(9_000 - 50 - REACH);
    expect(field.unitsPerTexel).toBe(1);
    expect(field.width).toBe(2 * (50 + REACH));
  });

  it('keeps a circle that has ended in revealed ground and out of vision', () => {
    const ended: FogCircle = { x: 17_300, y: 9_000, radius: 50, grown: 50, lasting: false };
    const field = fieldOf([seat, ended])!;

    expect(at(field, 17_300, 9_000).revealed).toBeLessThan(-40);
    expect(at(field, 17_300, 9_000).vision).toBe(REACH);
    expect(at(field, 17_000, 9_000).vision).toBeLessThan(-40);
  });

  it('takes the nearer edge where two circles overlap, so they read as one piece of ground', () => {
    const beside: FogCircle = { x: 17_080, y: 9_000, radius: 50, grown: 50, lasting: true };
    const field = fieldOf([seat, beside])!;

    // Halfway between the two middles, about forty units from each and ten inside both; the texel's
    // middle is half a unit nearer the second, so it is the second's edge that is nearer.
    expect(at(field, 17_040, 9_000).revealed).toBeCloseTo(-10.5, 1);
  });

  it('grows coarser rather than larger when a house sees from both ends of the world', () => {
    const far: FogCircle = { x: 31_000, y: 20_000, radius: 50, grown: 50, lasting: true };
    const field = fieldOf([{ ...seat, x: 1_000 }, far])!;

    expect(field.width).toBeLessThanOrEqual(MOST_TEXELS);
    expect(field.height).toBeLessThanOrEqual(MOST_TEXELS);
    expect(field.unitsPerTexel).toBeGreaterThan(1);
    expect(at(field, 31_000, 20_000).revealed).toBeLessThan(0);
  });
});

/** The two distances where a place stands, found through the same arithmetic the circles were placed by. */
function where(field: FogField, lat: number, lon: number): { revealed: number; vision: number } {
  const place = toMercator({ lng: lon, lat });
  return at(field, place.x * WORLD_MASTER_WIDTH, place.y * WORLD_MASTER_WIDTH);
}

const point = (lat: number, lon: number, kilometres = 34, until?: number): VisionPointView => ({
  kind: 'seat',
  place: { lat, lon },
  radius: kilometres,
  since: 0,
  ...(until === undefined ? {} : { until }),
});

/** Longitude for kilometres along the map at fifty north, where these circles stand. */
const east = (kilometres: number): number =>
  (kilometres / (40_075.016686 * Math.cos((50 * Math.PI) / 180))) * 360;

describe('the edge with surface tension', () => {
  const tension = 40;
  const circlesOf = (points: VisionPointView[], today = 1) =>
    points.map((one) => circleOf(one, today, tension));

  it('bridges a short gap between two circles, and leaves a long one open', () => {
    const near = fieldOf(circlesOf([point(50, 15), point(50, 15 + east(100))]), tension)!;
    const far = fieldOf(circlesOf([point(50, 15), point(50, 15 + east(160))]), tension)!;

    expect(where(near, 50, 15 + east(50)).revealed).toBeLessThan(-2);
    expect(where(near, 50, 15 + east(50)).vision).toBeLessThan(-2);
    expect(where(far, 50, 15 + east(80)).revealed).toBeGreaterThan(2);
  });

  it('bridges revealed ground to a circle that has ended, and not vision', () => {
    const field = fieldOf(circlesOf([point(50, 15), point(50, 15 + east(100), 34, 0)]), tension)!;

    expect(where(field, 50, 15 + east(50)).revealed).toBeLessThan(-2);
    expect(where(field, 50, 15 + east(50)).vision).toBeGreaterThan(2);
  });

  it('leaves a lone circle as it is', () => {
    const tense = fieldOf(circlesOf([point(50, 15)]), tension)!;
    const slack = fieldOf(circlesOf([point(50, 15)]), 0)!;
    // Three units beyond the edge of a circle of 34 km, which is 43 units here.
    const beyond = 15 + east(34 + 3 * 0.787);

    expect(where(tense, 50, beyond).revealed).toBeCloseTo(where(slack, 50, beyond).revealed, 0);
    expect(where(tense, 50, beyond).revealed).toBeGreaterThan(2);
  });

  it('does not swell where circles lie over one another', () => {
    const heap = [
      point(50, 15),
      point(50, 15 + east(1)),
      point(50, 15 - east(1)),
      point(50.009, 15),
      point(49.991, 15),
    ];
    const field = fieldOf(circlesOf(heap), tension)!;

    expect(where(field, 50, 15 + east(35 + 3)).revealed).toBeGreaterThan(2);
  });

  it('agrees with the shared vectors the gateway holds back by, to within the width of the soft edge', () => {
    const fixture = JSON.parse(coverage) as {
      vectors: {
        name: string;
        tension: number;
        circles: CoverageCircle[];
        place: { lat: number; lon: number };
        covered: boolean;
      }[];
    };
    let decided = 0;
    for (const vector of fixture.vectors) {
      const circles = vector.circles.map((one) =>
        circleOf(point(one.lat, one.lon, one.kilometres), 1, vector.tension),
      );
      const distance = where(fieldOf(circles, vector.tension)!, vector.place.lat, vector.place.lon).revealed;
      if (Math.abs(distance) > 1.5) {
        decided += 1;
        expect(distance < 0, vector.name).toBe(vector.covered);
      }
    }
    // Most of them are decided by more than the edge is soft, so this is a test and not a formality.
    expect(decided).toBeGreaterThan(10);
  });
});

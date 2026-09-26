import { describe, expect, it } from 'vitest';
import type { VisionPointView } from '@villages/protocol';

import { WORLD_MASTER_WIDTH } from '../map/worldStyle';

import { EQUATOR_KM, circleOf, kilometresPerUnit } from './circles';

const at = (lat: number, lon: number, until?: number): VisionPointView => ({
  kind: 'seat',
  place: { lat, lon },
  radius: 34,
  since: 100,
  ...(until === undefined ? {} : { until }),
});

describe('a vision point as the fog draws it', () => {
  it('is 34 km of ground, which is 28 world units on the equator and twice that at sixty north', () => {
    expect(kilometresPerUnit(0)).toBeCloseTo(EQUATOR_KM / WORLD_MASTER_WIDTH, 9);
    expect(circleOf(at(0, 0), 100).radius).toBeCloseTo(27.8, 1);
    expect(circleOf(at(60, 0), 100).radius).toBeCloseTo(55.6, 1);
  });

  it('stands where Mercator puts its place, in world units', () => {
    const middle = circleOf(at(0, 0), 100);
    expect(middle.x).toBeCloseTo(WORLD_MASTER_WIDTH / 2, 6);
    expect(middle.y).toBeCloseTo(WORLD_MASTER_WIDTH / 2, 6);

    const east = circleOf(at(0, 90), 100);
    expect(east.x).toBeCloseTo((WORLD_MASTER_WIDTH * 3) / 4, 6);

    // North is up the world, which is toward nought.
    expect(circleOf(at(59.33, 18.07), 100).y).toBeLessThan(WORLD_MASTER_WIDTH / 2);
  });

  it('lasts while it has no end, and has only revealed once it has ended', () => {
    expect(circleOf(at(59.33, 18.07), 100).lasting).toBe(true);
    expect(circleOf(at(59.33, 18.07, 100), 100).lasting).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { VisionPointView } from '@villages/protocol';

import reach from '../../../../../contracts/fixtures/reach.json?raw';
import { WORLD_MASTER_WIDTH } from '../map/worldStyle';

import { circleOf, standsInVision } from './circles';

const at = (lat: number, lon: number, until?: number): VisionPointView => ({
  kind: 'seat',
  place: { lat, lon },
  radius: 34,
  since: 100,
  ...(until === undefined ? {} : { until }),
});

describe('a vision point as the fog draws it', () => {
  it('is 34 km of ground, which is 28 world units on the equator and twice that at sixty north', () => {
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

describe('whether a place stands in vision', () => {
  const seat = circleOf(at(59.33, 18.07), 100);
  const ended = circleOf(at(57.64, 18.3, 100), 100);

  it('is inside a circle that still gives vision', () => {
    expect(standsInVision([seat], { lng: 18.07, lat: 59.33 })).toBe(true);
    // A little under the 34 km the circle reaches, north of the seat.
    expect(standsInVision([seat], { lng: 18.07, lat: 59.33 + 30 / 111 })).toBe(true);
  });

  it('is not outside it, nor inside a circle that has ended and only revealed', () => {
    expect(standsInVision([seat], { lng: 18.07, lat: 59.33 + 40 / 111 })).toBe(false);
    expect(standsInVision([seat, ended], { lng: 18.3, lat: 57.64 })).toBe(false);
    expect(standsInVision([], { lng: 18.07, lat: 59.33 })).toBe(false);
  });

  it('agrees with every shared vector, which is the arithmetic the gateway holds back by', () => {
    type Place = { lat: number; lon: number };
    const fixture = JSON.parse(reach) as {
      vectors: { name: string; centre: Place; kilometres: number; place: Place; within: boolean }[];
    };

    for (const vector of fixture.vectors) {
      const circle = circleOf({ kind: 'seat', place: vector.centre, radius: vector.kilometres, since: 0 }, 0);
      const place = { lng: vector.place.lon, lat: vector.place.lat };
      expect(standsInVision([circle], place), vector.name).toBe(vector.within);
    }
  });
});

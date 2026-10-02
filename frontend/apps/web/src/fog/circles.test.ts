import { describe, expect, it } from 'vitest';
import type { VisionPointView } from '@villages/protocol';

import reach from '../../../../../contracts/fixtures/reach.json?raw';
import { WORLD_MASTER_WIDTH } from '../geometry/world';
import { toMercator } from '../geometry/cameraMath';

import { circleOf, visionOf } from './circles';

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

  it('grows by the surface tension at its own latitude, and not at all without one', () => {
    expect(circleOf(at(0, 0), 100, 40).grown).toBeCloseTo((74 / 34) * 27.8, 0);
    expect(circleOf(at(0, 0), 100).grown).toBe(circleOf(at(0, 0), 100).radius);
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

  it('puts every circle where the shared vectors say, which is the arithmetic the gateway holds back by', () => {
    type Place = { lat: number; lon: number };
    const fixture = JSON.parse(reach) as {
      vectors: { name: string; centre: Place; kilometres: number; place: Place; within: boolean }[];
    };

    for (const vector of fixture.vectors) {
      const circle = circleOf({ kind: 'seat', place: vector.centre, radius: vector.kilometres, since: 0 }, 0);
      const place = toMercator({ lng: vector.place.lon, lat: vector.place.lat });
      const apart = Math.hypot(
        place.x * WORLD_MASTER_WIDTH - circle.x,
        place.y * WORLD_MASTER_WIDTH - circle.y,
      );
      expect(apart <= circle.radius, vector.name).toBe(vector.within);
    }
  });
});

describe('what the house has in vision, which decides what goes over the fog', () => {
  const seat = at(59.33, 18.07);
  const ended = at(57.64, 18.3, 100);
  /** A hundred kilometres east of the seat on the map: a gap of 32 km between the two circles. */
  const east = at(59.33, 19.83);

  it('is inside a circle that still gives vision', () => {
    const vision = visionOf([seat], 100, 40);

    expect(vision.covers({ lat: 59.33, lon: 18.07 })).toBe(true);
    // A little under the 34 km the circle reaches, north of the seat.
    expect(vision.covers({ lat: 59.33 + 30 / 111, lon: 18.07 })).toBe(true);
  });

  it('is not outside it, nor inside a circle that has ended and only revealed', () => {
    expect(visionOf([seat], 100, 40).covers({ lat: 59.33 + 40 / 111, lon: 18.07 })).toBe(false);
    expect(visionOf([seat, ended], 100, 40).covers({ lat: 57.64, lon: 18.3 })).toBe(false);
    expect(visionOf([], 100, 40).covers({ lat: 59.33, lon: 18.07 })).toBe(false);
  });

  it('reaches across a short gap between two circles, which is the surface tension', () => {
    expect(visionOf([seat, east], 100, 40).covers({ lat: 59.33, lon: 18.95 })).toBe(true);
    expect(visionOf([seat, east], 100, 0).covers({ lat: 59.33, lon: 18.95 })).toBe(false);
  });
});

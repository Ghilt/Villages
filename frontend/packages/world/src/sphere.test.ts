import { describe, expect, it } from 'vitest';

import {
  MAX_MERCATOR_LATITUDE,
  angularDistance,
  fromWorld,
  rotate,
  toLngLat,
  toVector,
  toWorld,
} from './sphere.ts';

const NO_TURN = { yaw: 0, pitch: 0, roll: 0 };

describe('the sphere', () => {
  it('sends a place to a unit vector and back again', () => {
    for (const place of [
      { lng: 0, lat: 0 },
      { lng: 18.0686, lat: 59.3293 },
      { lng: -122.4, lat: 37.8 },
      { lng: 179.9, lat: -41 },
    ]) {
      const there = toVector(place);
      expect(Math.hypot(there.x, there.y, there.z)).toBeCloseTo(1, 12);

      const back = toLngLat(there);
      expect(back.lng).toBeCloseTo(place.lng, 9);
      expect(back.lat).toBeCloseTo(place.lat, 9);
    }
  });

  it('measures the angle between places', () => {
    expect(angularDistance({ lng: 0, lat: 0 }, { lng: 0, lat: 0 })).toBeCloseTo(0, 9);
    expect(angularDistance({ lng: 0, lat: 0 }, { lng: 90, lat: 0 })).toBeCloseTo(90, 9);
    expect(angularDistance({ lng: 0, lat: -45 }, { lng: 0, lat: 45 })).toBeCloseTo(90, 9);
    expect(angularDistance({ lng: 0, lat: 90 }, { lng: 137, lat: -90 })).toBeCloseTo(180, 6);
  });
});

describe('turning the globe', () => {
  it('leaves everything where it was when there is no turn', () => {
    const place = { lng: 18.0686, lat: 59.3293 };
    const turned = rotate(place, NO_TURN);

    expect(turned.lng).toBeCloseTo(place.lng, 9);
    expect(turned.lat).toBeCloseTo(place.lat, 9);
  });

  it('slides the world east when it turns about the poles', () => {
    const turned = rotate({ lng: 10, lat: 0 }, { yaw: 25, pitch: 0, roll: 0 });

    expect(turned.lng).toBeCloseTo(35, 6);
    expect(turned.lat).toBeCloseTo(0, 9);
  });

  it('keeps every coastline the shape it was, because a turn preserves distance', () => {
    const turn = { yaw: 33, pitch: -12, roll: 7 };
    const a = { lng: 12.5683, lat: 55.6761 };
    const b = { lng: 18.0686, lat: 59.3293 };

    const before = angularDistance(a, b);
    const after = angularDistance(rotate(a, turn), rotate(b, turn));

    expect(after).toBeCloseTo(before, 9);
  });
});

describe('what Mercator can draw', () => {
  it('stops just short of the pole, where the projection would run to infinity', () => {
    expect(MAX_MERCATOR_LATITUDE).toBeGreaterThan(84);
    expect(MAX_MERCATOR_LATITUDE).toBeLessThan(90);
  });

  it('is the latitude where the projected world becomes square, which is what fixes the number', () => {
    // At the limit, the Mercator y of the latitude equals half the width of the world.
    const y = Math.log(Math.tan(Math.PI / 4 + (MAX_MERCATOR_LATITUDE * Math.PI) / 360));

    expect(y).toBeCloseTo(Math.PI, 5);
  });
});

describe('world space, the Mercator square the map is drawn on', () => {
  const WIDTH = 32768;

  it('puts the prime meridian and the equator in the middle, and the antimeridian on the west edge', () => {
    const middle = toWorld({ lng: 0, lat: 0 }, WIDTH);

    expect(middle.x).toBeCloseTo(WIDTH / 2, 9);
    expect(middle.y).toBeCloseTo(WIDTH / 2, 9);
    expect(toWorld({ lng: -180, lat: 0 }, WIDTH).x).toBe(0);
  });

  it('reaches the top edge at the Mercator limit, which is what makes it a square', () => {
    expect(toWorld({ lng: 0, lat: MAX_MERCATOR_LATITUDE }, WIDTH).y).toBeCloseTo(0, 2);
    expect(toWorld({ lng: 0, lat: -MAX_MERCATOR_LATITUDE }, WIDTH).y).toBeCloseTo(WIDTH, 2);
  });

  it('comes back to the place it started from', () => {
    for (const place of [
      { lng: 0, lat: 0 },
      { lng: 14.695, lat: 49.871 },
      { lng: -122.4, lat: 37.8 },
      { lng: 179.9, lat: -84 },
    ]) {
      const at = toWorld(place, WIDTH);
      const back = fromWorld(at.x, at.y, WIDTH);

      expect(back.lng).toBeCloseTo(place.lng, 10);
      expect(back.lat).toBeCloseTo(place.lat, 10);
    }
  });

  it('is not clamped, so a place past the limit lands off the square rather than on its edge', () => {
    expect(toWorld({ lng: 0, lat: 88 }, WIDTH).y).toBeLessThan(0);
    expect(toWorld({ lng: 190, lat: 0 }, WIDTH).x).toBeGreaterThan(WIDTH);
  });
});

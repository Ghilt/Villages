import { describe, expect, it } from 'vitest';

import { angularDistance, rotate, toLngLat, toVector } from './sphere.ts';

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

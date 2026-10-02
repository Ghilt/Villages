import { describe, expect, it } from 'vitest';

import { toScreen } from '../geometry/cameraMath';

import { CAMERA } from './mapConfig';
import { PLAYERS_TILT, tiltAt, tippedAbout } from './tilt';

describe('the camera tips as it comes in', () => {
  it('is straight down from zoom 7 out, and tipped 45 degrees at the closest zoom', () => {
    expect(tiltAt(4, PLAYERS_TILT)).toBe(0);
    expect(tiltAt(7, PLAYERS_TILT)).toBe(0);
    expect(tiltAt(CAMERA.maxZoom, PLAYERS_TILT)).toBe(45);
    expect(tiltAt(12, PLAYERS_TILT)).toBe(45);
  });

  it('tips further with every step in and never back', () => {
    let was = -1;
    for (let zoom = 6; zoom <= 10.5; zoom += 0.05) {
      const now = tiltAt(zoom, PLAYERS_TILT);
      expect(now, `at zoom ${zoom.toFixed(2)}`).toBeGreaterThanOrEqual(was);
      was = now;
    }
  });

  it('starts and stops without a jolt, and has no step anywhere between', () => {
    const step = 0.001;
    // Eased: at both ends a thousandth of a zoom level tips it by next to nothing.
    expect(tiltAt(7 + step, PLAYERS_TILT)).toBeLessThan(0.0001);
    expect(45 - tiltAt(10 - step, PLAYERS_TILT)).toBeLessThan(0.0001);
    for (let zoom = 7; zoom < 10; zoom += 0.01) {
      expect(
        Math.abs(tiltAt(zoom + step, PLAYERS_TILT) - tiltAt(zoom, PLAYERS_TILT)),
        `at ${zoom.toFixed(2)}`,
      ).toBeLessThan(0.05);
    }
  });

  it('is halfway up halfway along, because the ease is even at both ends', () => {
    expect(tiltAt(8.5, PLAYERS_TILT)).toBeCloseTo(22.5, 9);
  });

  it('is a step rather than a division by nothing when the ramp has no length', () => {
    const flatThenTipped = { from: 10, to: 10, most: 30 };
    expect(tiltAt(9.99, flatThenTipped)).toBe(0);
    expect(tiltAt(10, flatThenTipped)).toBe(30);
  });
});

describe('tipping about the pointer', () => {
  const window = { width: 900, height: 700 };

  it('leaves the ground under the pointer where it was, whatever the tilt and the turn', () => {
    // A wheel zoom keeps whatever ground is under the pointer each frame, so a tip that moved it would be
    // kept, frame after frame, as a slide. This is what stops that.
    for (const [from, to, bearing] of [
      [0, 4.5, 0],
      [20, 26, 0],
      [44, 45, 0],
      [10, 30, 70],
    ] as const) {
      const place = { lng: 16.3, lat: 49.6 };
      const before = { center: { lng: 16, lat: 50 }, zoom: 8.2, ...window, pitch: from, bearing };
      const under = toScreen(place, before);
      const centre = tippedAbout(
        before.center,
        before.zoom,
        under,
        window,
        { pitch: from, bearing },
        { pitch: to, bearing },
      );
      const after = toScreen(place, { ...before, center: centre, pitch: to });
      expect(after.x, `${from}->${to} turned ${bearing}`).toBeCloseTo(under.x, 6);
      expect(after.y, `${from}->${to} turned ${bearing}`).toBeCloseTo(under.y, 6);
    }
  });

  it('leaves the centre alone when the pointer is at the middle, which is how a flight is tipped', () => {
    const centre = { lng: 16, lat: 50 };
    const moved = tippedAbout(
      centre,
      9,
      { x: 450, y: 350 },
      window,
      { pitch: 10, bearing: 0 },
      { pitch: 30, bearing: 0 },
    );
    expect(moved.lng).toBeCloseTo(centre.lng, 9);
    expect(moved.lat).toBeCloseTo(centre.lat, 9);
  });
});

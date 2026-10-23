import { describe, expect, it } from 'vitest';

import type { CameraView } from '../../geometry/cameraMath';
import { STILL } from './physics';
import { DIE_SETTINGS, letGo } from './throwing';

/** Over Bohemia at zoom 8.5, looking straight down, as the game opens on a house founded there. */
const VIEW: CameraView = {
  center: { lng: 15.18, lat: 49.75 },
  zoom: 8.5,
  width: 1280,
  height: 800,
  pitch: 0,
  bearing: 0,
};

/** Kilometres between two places, near enough for a few of them. */
const kmApart = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((a.lat - b.lat) * 111.32, (a.lon - b.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180));

describe('a die let go', () => {
  it('dropped, comes to rest by its shadow and says where on the Earth', () => {
    const middle = { x: VIEW.width / 2, y: VIEW.height / 2 };
    const dropped = letGo(middle, { x: 0, y: 0 }, STILL, VIEW, DIE_SETTINGS, () => [], 0).rested;

    expect(dropped.how).toBe('dropped');
    // A die width is two world units, about two kilometres here: it strays a few of them at most.
    expect(kmApart({ lat: dropped.lat, lon: dropped.lon }, { lat: 49.75, lon: 15.18 })).toBeLessThan(15);
  });

  it('dropped off the middle of the view, rests under where it was let go, not under the middle', () => {
    const east = { x: VIEW.width / 2 + 400, y: VIEW.height / 2 };
    const dropped = letGo(east, { x: 0, y: 0 }, STILL, VIEW, DIE_SETTINGS, () => [], 0).rested;

    expect(dropped.lon).toBeGreaterThan(15.18 + 0.5);
    expect(Math.abs(dropped.lat - 49.75)).toBeLessThan(0.2);
  });

  it('flicked, is thrown on the way the hand went, further than a drop', () => {
    const middle = { x: VIEW.width / 2, y: VIEW.height / 2 };
    const thrown = letGo(middle, { x: 900, y: 0 }, STILL, VIEW, DIE_SETTINGS, () => [], 0).rested;

    expect(thrown.how).toBe('thrown');
    expect(thrown.lon).toBeGreaterThan(15.18 + 0.5);
  });
});

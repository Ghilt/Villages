import { describe, expect, it } from 'vitest';

import {
  MAX_MERCATOR_LATITUDE,
  WORLD_UNIT_ZOOM,
  fromMercator,
  isWithinView,
  pixelsPerWorldUnit,
  toMercator,
  toMercatorExact,
  toScreen,
  worldSize,
} from './cameraMath';
import type { CameraView } from './cameraMath';

const view: CameraView = { center: { lng: 0, lat: 0 }, zoom: 4, width: 1000, height: 600 };

describe('the Mercator projection', () => {
  it('puts the origin of the world at its middle', () => {
    expect(toMercator({ lng: 0, lat: 0 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('spans the unit square from edge to edge', () => {
    expect(toMercator({ lng: -180, lat: 0 }).x).toBeCloseTo(0, 10);
    expect(toMercator({ lng: 180, lat: 0 }).x).toBeCloseTo(1, 10);
  });

  it('runs north up the square', () => {
    expect(toMercator({ lng: 0, lat: 60 }).y).toBeLessThan(toMercator({ lng: 0, lat: 30 }).y);
  });

  it('clamps the poles rather than diverging', () => {
    const atLimit = toMercator({ lng: 0, lat: MAX_MERCATOR_LATITUDE });
    expect(toMercator({ lng: 0, lat: 90 }).y).toBeCloseTo(atLimit.y, 10);
    expect(Number.isFinite(toMercator({ lng: 0, lat: -90 }).y)).toBe(true);
  });
});

describe('the exact projection and its inverse', () => {
  it('agrees with the clamped one anywhere on the world', () => {
    expect(toMercatorExact({ lng: 12, lat: 56 })).toEqual(toMercator({ lng: 12, lat: 56 }));
  });

  it('runs on past the edges of the world rather than stopping at them', () => {
    expect(toMercatorExact({ lng: 0, lat: 89 }).y).toBeLessThan(0);
    expect(toMercatorExact({ lng: 200, lat: 0 }).x).toBeGreaterThan(1);
  });

  it('comes back to where it started', () => {
    for (const place of [
      { lng: 10.5, lat: 55.5 },
      { lng: -179, lat: -80 },
      { lng: 0, lat: 89.99 },
    ]) {
      const back = fromMercator(toMercatorExact(place));
      expect(back.lng).toBeCloseTo(place.lng, 9);
      expect(back.lat).toBeCloseTo(place.lat, 9);
    }
  });

  it('saturates at the poles, so any point on the plane is a latitude MapLibre accepts', () => {
    expect(fromMercator({ x: 0.5, y: -1 }).lat).toBeGreaterThan(85);
    expect(fromMercator({ x: 0.5, y: -1 }).lat).toBeLessThan(90);
    expect(fromMercator({ x: 0.5, y: -50 }).lat).toBe(90);
    expect(fromMercator({ x: 0.5, y: 50 }).lat).toBe(-90);
  });

  it('places the world by an exact centre, so a camera far north of it puts the top edge below the window', () => {
    // Clamping the centre to the edge of the world would put the top edge at the middle of the window.
    const farNorth: CameraView = { center: { lng: 0, lat: 89.99 }, zoom: 0, width: 1000, height: 1000 };

    expect(toScreen({ lng: 0, lat: MAX_MERCATOR_LATITUDE }, farNorth).y).toBeGreaterThan(farNorth.height);
  });
});

describe('the world size', () => {
  it('doubles with every zoom level', () => {
    expect(worldSize(1)).toBe(worldSize(0) * 2);
    expect(worldSize(8)).toBe(worldSize(7) * 2);
  });
});

describe('placing a place on the screen', () => {
  it('draws the camera centre in the middle of the container', () => {
    const point = toScreen(view.center, view);

    expect(point.x).toBeCloseTo(view.width / 2, 9);
    expect(point.y).toBeCloseTo(view.height / 2, 9);
  });

  it('puts east to the right and north above', () => {
    const east = toScreen({ lng: 5, lat: 0 }, view);
    const north = toScreen({ lng: 0, lat: 5 }, view);

    expect(east.x).toBeGreaterThan(view.width / 2);
    expect(north.y).toBeLessThan(view.height / 2);
  });

  it('doubles the distance from the centre for every zoom level', () => {
    const near = toScreen({ lng: 5, lat: 5 }, view);
    const closer = toScreen({ lng: 5, lat: 5 }, { ...view, zoom: view.zoom + 1 });

    expect(closer.x - view.width / 2).toBeCloseTo((near.x - view.width / 2) * 2, 6);
    expect(closer.y - view.height / 2).toBeCloseTo((near.y - view.height / 2) * 2, 6);
  });

  it('agrees with a hand-computed position', () => {
    // At zoom 0 the world is 512 pixels wide, so a quarter of the way east of the centre is 128 pixels.
    const flat: CameraView = { center: { lng: 0, lat: 0 }, zoom: 0, width: 512, height: 512 };

    expect(toScreen({ lng: 90, lat: 0 }, flat).x).toBeCloseTo(256 + 128, 9);
  });
});

describe('deciding what to draw', () => {
  it('keeps sprites that are just outside the container', () => {
    expect(isWithinView({ x: -20, y: 300 }, view)).toBe(true);
    expect(isWithinView({ x: view.width + 20, y: 300 }, view)).toBe(true);
  });

  it('drops sprites that are far away', () => {
    expect(isWithinView({ x: -500, y: 300 }, view)).toBe(false);
    expect(isWithinView({ x: 500, y: view.height + 500 }, view)).toBe(false);
  });
});

describe('one unit of world space', () => {
  it('is one screen pixel at the zoom the doubling is measured from', () => {
    expect(pixelsPerWorldUnit(WORLD_UNIT_ZOOM)).toBeCloseTo(1, 9);
    expect(WORLD_UNIT_ZOOM).toBe(6);
  });

  it('doubles with every zoom level, exactly as the terrain under it does', () => {
    for (const zoom of [0, 4, 7, 9]) {
      expect(pixelsPerWorldUnit(zoom + 1)).toBeCloseTo(pixelsPerWorldUnit(zoom) * 2, 9);
    }
  });

  it('is sixteen pixels at the closest the camera comes', () => {
    expect(pixelsPerWorldUnit(10)).toBeCloseTo(16, 9);
  });
});

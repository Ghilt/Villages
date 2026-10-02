import { describe, expect, it } from 'vitest';

import {
  DIAMOND_BEARING,
  DIMETRIC_PITCH,
  ISOMETRIC_PITCH,
  PARALLEL_FOV,
  TRIMETRIC_BEARING,
  TRIMETRIC_PITCH,
  lensOf,
} from '../debug/camera';
import { WORLD_MASTER_WIDTH } from './world';

import {
  MAX_MERCATOR_LATITUDE,
  WORLD_UNIT_ZOOM,
  fartherFirst,
  fromMercator,
  groundTilt,
  isWithinView,
  pixelsPerWorldUnit,
  standingLayer,
  tiltGround,
  toMercator,
  toMercatorExact,
  toScreen,
  untiltGround,
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

describe('a camera that has been turned and tipped', () => {
  /** The four corners of a square of ground, as the screen draws them. */
  const cornersOf = (from: CameraView) => {
    const span = 4;
    const at = (lng: number, lat: number) => toScreen({ lng, lat }, from);
    return { nw: at(-span, span), ne: at(span, span), sw: at(-span, -span), se: at(span, -span) };
  };
  const edge = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: b.x - a.x,
    y: b.y - a.y,
  });

  it('is exactly what it always was when it is flat and north-up', () => {
    const place = { lng: 12, lat: 34 };
    const was = toScreen(place, view);
    expect(toScreen(place, { ...view, pitch: 0, bearing: 0 })).toEqual(was);
  });

  it('draws a square of ground twice as wide as it is tall at sixty degrees', () => {
    // Sixty degrees is the whole reason isometric tiles are 2:1: its cosine is exactly a half.
    const { nw, ne } = cornersOf({ ...view, pitch: 60, bearing: 45 });
    const top = edge(nw, ne);
    expect(Math.abs(top.x) / Math.abs(top.y)).toBeCloseTo(2, 9);
  });

  it('foreshortens all three axes equally at the true isometric angle', () => {
    const { nw, ne } = cornersOf({ ...view, pitch: ISOMETRIC_PITCH, bearing: 45 });
    const top = edge(nw, ne);
    expect(Math.abs(top.x) / Math.abs(top.y)).toBeCloseTo(Math.sqrt(3), 9);
  });

  it('keeps opposite edges parallel, which is what makes it a projection and not a perspective', () => {
    for (const pitch of [0, 30, 54.7356, 60, 80]) {
      const { nw, ne, sw, se } = cornersOf({ ...view, pitch, bearing: 45 });
      const top = edge(nw, ne);
      const bottom = edge(sw, se);
      expect(top.x).toBeCloseTo(bottom.x, 9);
      expect(top.y).toBeCloseTo(bottom.y, 9);
    }
  });

  it('turns the world without changing the size of anything on it', () => {
    const flat = cornersOf({ ...view, bearing: 0 });
    const turned = cornersOf({ ...view, bearing: 90 });
    const was = edge(flat.nw, flat.ne);
    const now = edge(turned.nw, turned.ne);
    expect(Math.hypot(now.x, now.y)).toBeCloseTo(Math.hypot(was.x, was.y), 9);
    // A quarter turn clockwise puts what was east up the screen.
    expect(now.x).toBeCloseTo(0, 9);
    expect(now.y).toBeCloseTo(-Math.abs(was.x), 9);
  });

  it('leaves the place the camera is pointing at in the middle, whatever it is doing', () => {
    for (const [pitch, bearing] of [
      [0, 0],
      [60, 45],
      [80, 200],
    ]) {
      const point = toScreen(view.center, { ...view, pitch, bearing });
      expect(point.x).toBeCloseTo(view.width / 2, 9);
      expect(point.y).toBeCloseTo(view.height / 2, 9);
    }
  });
});

describe('the three names for a parallel projection', () => {
  /** How long each of the three axes is drawn, for a camera. One world unit east, north, and upright. */
  const axesAt = (pitch: number, bearing: number) => {
    const turn = (bearing * Math.PI) / 180;
    const lean = Math.cos((pitch * Math.PI) / 180);
    const east = Math.hypot(Math.cos(turn), Math.sin(turn) * lean);
    const north = Math.hypot(Math.sin(turn), Math.cos(turn) * lean);
    // Nothing in this world has height, so the upright is notional; it is still what the names count.
    return [east, north, Math.sin((pitch * Math.PI) / 180)];
  };
  const alike = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const howManyAlike = ([a, b, c]: number[]) =>
    [alike(a!, b!), alike(b!, c!), alike(a!, c!)].filter(Boolean).length;

  it('calls it isometric when all three axes are drawn the same length', () => {
    expect(howManyAlike(axesAt(ISOMETRIC_PITCH, DIAMOND_BEARING))).toBe(3);
  });

  it('calls it dimetric when two are alike, which is what the diamond turn gives', () => {
    const [east, north, up] = axesAt(DIMETRIC_PITCH, DIAMOND_BEARING);
    expect(east).toBeCloseTo(north!, 9);
    expect(up).not.toBeCloseTo(east!, 6);
  });

  it('calls it trimetric when no two are alike', () => {
    expect(howManyAlike(axesAt(TRIMETRIC_PITCH, TRIMETRIC_BEARING))).toBe(0);
  });

  it('draws a lopsided diamond off the diamond turn, and an even one on it', () => {
    const even = cornersOfSquare(DIMETRIC_PITCH, DIAMOND_BEARING);
    expect(Math.abs(even.east)).toBeCloseTo(Math.abs(even.north), 9);
    const lopsided = cornersOfSquare(TRIMETRIC_PITCH, TRIMETRIC_BEARING);
    expect(Math.abs(lopsided.east)).not.toBeCloseTo(Math.abs(lopsided.north), 3);
  });
});

/**
 * The screen length of one small step of ground east and the same step north, for a camera.
 *
 * The step is small on purpose. Mercator stretches north as it goes, so a whole degree of latitude and a
 * whole degree of longitude are not the same piece of ground even on the equator, and comparing them
 * measures the projection of the world rather than the projection of the camera.
 */
function cornersOfSquare(pitch: number, bearing: number) {
  const step = 0.001;
  const from: CameraView = {
    center: { lng: 0, lat: 0 },
    zoom: 4,
    width: 1000,
    height: 600,
    pitch,
    bearing,
  };
  const middle = toScreen({ lng: 0, lat: 0 }, from);
  const east = toScreen({ lng: step, lat: 0 }, from);
  const north = toScreen({ lng: 0, lat: step }, from);
  return {
    east: Math.hypot(east.x - middle.x, east.y - middle.y),
    north: Math.hypot(north.x - middle.x, north.y - middle.y),
  };
}

describe('things standing on tipped ground', () => {
  const cameras = [
    [0, 0],
    [45, 0],
    [DIMETRIC_PITCH, DIAMOND_BEARING],
    [ISOMETRIC_PITCH, DIAMOND_BEARING],
    [TRIMETRIC_PITCH, TRIMETRIC_BEARING],
    [30, 200],
  ] as const;
  const places = [
    { lng: 10.5, lat: 47.2 },
    { lng: 10.9, lat: 46.8 },
    { lng: 9.7, lat: 47.6 },
  ];

  it('lands a foot placed by the standing layer exactly where toScreen puts the same place', () => {
    // The scenery and the marks are placed by two routes, and this is what keeps them one projection: a
    // tree two pixels off the place a castle beside it stands on is a fault nobody can see the cause of.
    for (const [pitch, bearing] of cameras) {
      for (const zoom of [7, 9.8, 10]) {
        const camera: CameraView = {
          center: { lng: 10.4, lat: 47.1 },
          zoom,
          width: 1024,
          height: 768,
          pitch,
          bearing,
        };
        const layer = standingLayer(camera);
        for (const place of places) {
          const unit = toMercator(place);
          const tilted = tiltGround(unit.x * WORLD_MASTER_WIDTH, unit.y * WORLD_MASTER_WIDTH, layer.tilt);
          const mark = toScreen(place, camera);
          expect(
            Math.abs(layer.scale * tilted.x + layer.x - mark.x),
            `${pitch}/${bearing}/${zoom}`,
          ).toBeLessThan(1e-6);
          expect(
            Math.abs(layer.scale * tilted.y + layer.y - mark.y),
            `${pitch}/${bearing}/${zoom}`,
          ).toBeLessThan(1e-6);
        }
      }
    }
  });

  it('carries a screen offset back onto the ground it came from', () => {
    for (const [pitch, bearing] of cameras) {
      const tilt = groundTilt({ pitch, bearing });
      const on = tiltGround(123.4, -56.7, tilt);
      const back = untiltGround(on.x, on.y, tilt);
      expect(back.east).toBeCloseTo(123.4, 9);
      expect(back.south).toBeCloseTo(-56.7, 9);
    }
  });

  it('never scales a layer differently across and down, which is what keeps a picture upright and whole', () => {
    const layer = standingLayer({ ...view, pitch: DIMETRIC_PITCH, bearing: DIAMOND_BEARING });
    // One number: the layer only grows and moves. The tip is in where each foot is, not in the picture.
    expect(layer.scale).toBe(pixelsPerWorldUnit(view.zoom));
  });

  it('draws the farther of two things first, whichever order they arrived in', () => {
    const feet = [
      { x: 5, y: 40 },
      { x: 1, y: 10 },
      { x: 9, y: 10 },
      { x: 3, y: 25 },
    ];
    const once = [...feet].sort(fartherFirst);
    const reversed = [...feet].reverse().sort(fartherFirst);
    expect(once).toEqual([
      { x: 1, y: 10 },
      { x: 9, y: 10 },
      { x: 3, y: 25 },
      { x: 5, y: 40 },
    ]);
    // The same feet in any order give the same picture, so nothing swaps places between frames.
    expect(reversed).toEqual(once);
  });

  it('sees parallel whenever it tips at all, so no lever can slide a tree off its ground', () => {
    expect(lensOf({ tilt: 0.5 })).toBe(PARALLEL_FOV);
    expect(lensOf({ tilt: DIMETRIC_PITCH })).toBe(PARALLEL_FOV);
    expect(lensOf({ tilt: 0 })).toBeGreaterThan(30);
  });
});

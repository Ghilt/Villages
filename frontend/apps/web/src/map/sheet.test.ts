import { describe, expect, it } from 'vitest';

import { MAX_MERCATOR_LATITUDE } from '../sprites/cameraMath';

import { CAMERA } from './mapConfig';
import {
  clampAxis,
  clampBoundsToWorld,
  constrainCamera,
  fitZoom,
  floorZoom,
  sheetCoversView,
  sheetOnScreen,
} from './sheet';

const landscape = { width: 1920, height: 1000 };

describe('the floor and the fit', () => {
  it('puts the sheet at half the shorter side of a landscape window', () => {
    // Half of 1000 is 500 pixels, a shade under the 512 pixel world at zoom 0.
    expect(floorZoom(landscape)).toBeCloseTo(Math.log2(500 / 512), 6);
  });

  it('measures a portrait window by its width', () => {
    expect(floorZoom({ width: 500, height: 900 })).toBeCloseTo(Math.log2(250 / 512), 6);
  });

  it('never asks MapLibre for less than it allows', () => {
    expect(floorZoom({ width: 100, height: 100 })).toBe(CAMERA.minZoom);
    expect(floorZoom({ width: 0, height: 0 })).toBe(CAMERA.minZoom);
  });

  it('has the sheet cover the window from the fit zoom, which is set by the longer side', () => {
    expect(fitZoom(landscape)).toBeCloseTo(Math.log2(1920 / 512), 6);
  });
});

describe('keeping the camera on the sheet, along one axis', () => {
  it('keeps the window inside the world when the world is the larger, as MapLibre does', () => {
    expect(clampAxis(100, 2048, 1000)).toBe(500);
    expect(clampAxis(1900, 2048, 1000)).toBe(1548);
    expect(clampAxis(1000, 2048, 1000)).toBe(1000);
  });

  it('keeps the sheet inside the window when the window is the larger', () => {
    // A centre of 0 puts the sheet's edge at the middle of the window, so it is flush with the far side.
    expect(clampAxis(-300, 500, 1000)).toBe(0);
    expect(clampAxis(900, 500, 1000)).toBe(500);
    expect(clampAxis(250, 500, 1000)).toBe(250);
  });

  it('meets in a single point where the sheet is exactly the window, so crossing never jumps', () => {
    expect(clampAxis(0, 1000, 1000)).toBe(500);
    expect(clampAxis(1000, 1000, 1000)).toBe(500);
    expect(clampAxis(0, 1001, 1000)).toBeCloseTo(500, 6);
    expect(clampAxis(0, 999, 1000)).toBeCloseTo(499, 6);
  });
});

describe('keeping the camera on the sheet', () => {
  const middle = { x: 0.5, y: 0.5 };

  it('holds the zoom between the floor and the ceiling, which MapLibre no longer does for us', () => {
    expect(constrainCamera({ centre: middle, zoom: -3 }, landscape, 10).zoom).toBeCloseTo(
      floorZoom(landscape),
      9,
    );
    expect(constrainCamera({ centre: middle, zoom: 12 }, landscape, 10).zoom).toBe(10);
  });

  it('leaves a camera that is already on the sheet alone', () => {
    const camera = { centre: middle, zoom: 4 };

    expect(constrainCamera(camera, landscape, 10)).toEqual(camera);
  });

  it('lets the centre leave the world, so the sheet can reach the corner of a wide window', () => {
    // At zoom 0 the sheet is 512 pixels in a 1920 pixel window. Flush right, the centre is 448 pixels
    // left of the world's edge, which is the sheet's left edge at 1408 and its right edge at the window's.
    const kept = constrainCamera({ centre: { x: -2, y: 0.5 }, zoom: 0 }, landscape, 10);

    expect(kept.centre.x).toBeCloseTo(-448 / 512, 9);
    expect(kept.centre.y).toBeCloseTo(0.5, 9);
  });

  it('but never more than two worlds away, where the round trip to a latitude loses pixels', () => {
    const kept = constrainCamera({ centre: { x: -20, y: 0.5 }, zoom: -1 }, { width: 8000, height: 500 }, 10);

    expect(kept.centre.x).toBe(-2);
  });
});

describe('where the sheet lies in the window', () => {
  it('is the world, centred, at zoom 0 in a landscape window', () => {
    const sheet = sheetOnScreen({ center: { lng: 0, lat: 0 }, zoom: 0, ...landscape });

    expect(sheet.size).toBe(512);
    expect(sheet.left).toBeCloseTo(704, 6);
    expect(sheet.top).toBeCloseTo(244, 4);
    expect(sheetCoversView(sheet, landscape)).toBe(false);
  });

  it('covers the window from the fit zoom', () => {
    const view = { center: { lng: 0, lat: 0 }, zoom: 2, ...landscape };

    expect(sheetCoversView(sheetOnScreen(view), view)).toBe(true);
  });

  it('does not cover it while the sheet is taller than the window but narrower', () => {
    const view = { center: { lng: 0, lat: 0 }, zoom: 1.5, ...landscape };

    expect(sheetCoversView(sheetOnScreen(view), view)).toBe(false);
  });

  it('counts a sheet exactly the window as covering it, rather than flickering on a hairline', () => {
    const square = { width: 512, height: 512 };

    expect(sheetCoversView(sheetOnScreen({ center: { lng: 0, lat: 0 }, zoom: 0, ...square }), square)).toBe(
      true,
    );
  });
});

describe('clamping a view to the world', () => {
  it('pulls edges that run past the world back to it', () => {
    expect(clampBoundsToWorld({ north: 89.9, south: -89.9, east: 220, west: -250 })).toEqual({
      north: MAX_MERCATOR_LATITUDE,
      south: -MAX_MERCATOR_LATITUDE,
      east: 180,
      west: -180,
    });
  });

  it('leaves a view on the world alone', () => {
    const denmark = { north: 58, south: 54, east: 13, west: 8 };

    expect(clampBoundsToWorld(denmark)).toEqual(denmark);
  });
});

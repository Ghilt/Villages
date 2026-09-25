import { describe, expect, it } from 'vitest';

import { MAX_MERCATOR_LATITUDE, fromMercator, toScreen } from '../sprites/cameraMath';

import { CAMERA } from './mapConfig';
import {
  clampAxis,
  clampBoundsToWorld,
  constrainCamera,
  drawnAt,
  fitZoom,
  flatPoint,
  flatWindow,
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

describe('a camera tipped back and north-up', () => {
  const window = { width: 1000, height: 700 };

  it('changes nothing when it is not tipped', () => {
    expect(flatWindow(window, 0)).toEqual(window);
    expect(drawnAt({ left: 3, top: 40, width: 10, height: 20 }, 0)).toEqual({
      left: 3,
      top: 40,
      width: 10,
      height: 20,
    });
    expect(flatPoint({ x: 5, y: 9 }, 0)).toEqual({ x: 5, y: 9 });
  });

  it('draws the sheet laid out flat exactly where the tipped map draws the world', () => {
    // The desk is laid out as if the camera looked straight down and squashed as it is drawn; the map and
    // the marks are projected tipped. If the two ever disagree, the parchment slides off its own tiles.
    for (const pitch of [30, 45, 60]) {
      for (const zoom of [-0.5, 0.3, 1]) {
        const centre = { lng: 12, lat: 20 };
        const lying = sheetOnScreen({ center: centre, zoom, ...flatWindow(window, pitch) });
        const drawn = drawnAt(
          { left: lying.left, top: lying.top, width: lying.size, height: lying.size },
          pitch,
        );
        const tipped = { center: centre, zoom, ...window, pitch, bearing: 0 };
        const northWest = toScreen({ lng: -180, lat: MAX_MERCATOR_LATITUDE }, tipped);
        const southEast = toScreen({ lng: 180, lat: -MAX_MERCATOR_LATITUDE }, tipped);
        // To a thousandth of a pixel: the world's edge is a latitude written to six places, so the far
        // corner projects a few millionths of a pixel short of a whole world width.
        expect(drawn.left).toBeCloseTo(northWest.x, 3);
        expect(drawn.top).toBeCloseTo(northWest.y, 3);
        expect(drawn.left + drawn.width).toBeCloseTo(southEast.x, 3);
        expect(drawn.top + drawn.height).toBeCloseTo(southEast.y, 3);
      }
    }
  });

  it('keeps the whole tipped window on the world at its northern edge, not only the part a flat one sees', () => {
    const pitch = 45;
    const zoom = 3;
    const kept = constrainCamera(
      { centre: { x: 0.5, y: 0 }, zoom },
      flatWindow(window, pitch),
      CAMERA.maxZoom,
    );
    const tipped = { center: fromMercator(kept.centre), zoom: kept.zoom, ...window, pitch, bearing: 0 };
    // The top of the world lies exactly along the top of the window: no sky above it.
    expect(toScreen({ lng: 0, lat: MAX_MERCATOR_LATITUDE }, tipped).y).toBeCloseTo(0, 3);
  });

  it('carries a point from the real window into the flat one and back', () => {
    const flat = flatPoint({ x: 120, y: 300 }, 45);
    expect(flat.y).toBeCloseTo(300 / Math.cos(Math.PI / 4), 9);
    expect(drawnAt({ top: flat.y, height: 0 }, 45).top).toBeCloseTo(300, 9);
  });
});

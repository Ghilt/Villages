import { describe, expect, it } from 'vitest';

import { deskOnScreen } from '../desk/deskTop';
import { floorZoom } from '../map/sheet';
import type { Viewport } from '../map/sheet';
import { worldSize } from '../geometry/cameraMath';

import {
  aboutWithin,
  atTheEnd,
  middleOf,
  pulledBack,
  roomAtTurn,
  roomOnScreen,
  scaledAbout,
  scaleFor,
  sheetAtFloor,
  spanOf,
  turnsAt,
  wheelZooms,
} from './roomBox';

const STAGES: Viewport[] = [
  { width: 1600, height: 900 },
  { width: 1280, height: 720 },
  { width: 928, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

const roomFor = (viewport: Viewport) => roomOnScreen(deskOnScreen(sheetAtFloor(viewport), viewport));

describe('the sheet at the floor', () => {
  it('is where the sheet actually is once the camera is put at the floor over the world centre', () => {
    for (const viewport of STAGES) {
      const size = worldSize(floorZoom(viewport));
      expect(sheetAtFloor(viewport)).toEqual({
        left: (viewport.width - size) / 2,
        top: (viewport.height - size) / 2,
        size,
      });
    }
  });
});

describe('the room', () => {
  it('is concentric with the desk, so pulling back draws away from the map and not from a corner', () => {
    const viewport = { width: 1600, height: 900 };
    const desk = deskOnScreen(sheetAtFloor(viewport), viewport);
    const room = roomOnScreen(desk);
    expect(room.left + room.width / 2).toBeCloseTo(desk.left + desk.width / 2);
    expect(room.top + room.height / 2).toBeCloseTo(desk.top + desk.height / 2);
  });

  it('is larger than the desk it holds', () => {
    for (const viewport of STAGES) {
      const desk = deskOnScreen(sheetAtFloor(viewport), viewport);
      expect(roomOnScreen(desk).width).toBeGreaterThan(desk.width);
    }
  });
});

describe('the turn', () => {
  it('leaves the room filling the window, so there is almost no surround when the camera jumps', () => {
    for (const viewport of STAGES) {
      const rect = roomAtTurn(sheetAtFloor(viewport), viewport);
      const short = Math.min(rect.width, rect.height) / Math.min(viewport.width, viewport.height);
      // Never less than filling it, because a gap is where the illusion would show.
      expect(short).toBeGreaterThanOrEqual(0.9);
      expect(short).toBeLessThan(1.7);
    }
  });

  it('is centred in the window, wherever the sheet was', () => {
    const viewport = { width: 1600, height: 900 };
    const rect = roomAtTurn(sheetAtFloor(viewport), viewport);
    expect(rect.left + rect.width / 2).toBeCloseTo(viewport.width / 2);
    expect(rect.top + rect.height / 2).toBeCloseTo(viewport.height / 2);
  });

  it('is a journey of between one and three zoom levels on every shape the stage can be', () => {
    for (const viewport of STAGES) {
      const span = spanOf(turnsAt(roomFor(viewport), viewport));
      expect(span).toBeGreaterThanOrEqual(1.2);
      expect(span).toBeLessThanOrEqual(2.6);
    }
  });
});

describe('the scale a pull comes to', () => {
  it('is one at rest, and the scale the turn happens at when it is spent', () => {
    const wide = { width: 1600, height: 900 };
    const turn = turnsAt(roomFor(wide), wide);
    expect(scaleFor(0, turn)).toBe(1);
    expect(scaleFor(1, turn)).toBeCloseTo(turn);
  });

  it('is exponential, so equal pushes are equal ratios and it reads as more of the same zoom', () => {
    const turn = 0.25;
    const quarter = scaleFor(0.25, turn);
    const half = scaleFor(0.5, turn);
    const threeQuarters = scaleFor(0.75, turn);
    expect(half / quarter).toBeCloseTo(quarter / 1);
    expect(threeQuarters / half).toBeCloseTo(half / quarter);
  });

  it('never runs past either end', () => {
    expect(scaleFor(-3, 0.25)).toBe(1);
    expect(scaleFor(9, 0.25)).toBeCloseTo(0.25);
  });
});

describe('a wheel', () => {
  it('is worth what MapLibre thinks it is worth, so a notch past the floor matches one above it', () => {
    // A mouse notch is 100 pixels and takes the slower of MapLibre's two rates.
    expect(wheelZooms(100, 0)).toBeCloseTo(Math.log2(2 / (1 + Math.exp(-100 / 450))), 10);
    // A trackpad's small deltas take the faster one.
    expect(wheelZooms(3, 0)).toBeCloseTo(Math.log2(2 / (1 + Math.exp(-0.03))), 10);
  });

  it('counts a Firefox line as forty pixels, which is the difference between working and not', () => {
    expect(wheelZooms(3, 1)).toBeCloseTo(wheelZooms(120, 0), 10);
  });

  it('is always a push, whichever way it was turned', () => {
    expect(wheelZooms(-100, 0)).toBeCloseTo(wheelZooms(100, 0), 10);
    expect(wheelZooms(0, 0)).toBeCloseTo(Math.log2(1), 10);
  });

  it('never moves more than one zoom level at once', () => {
    expect(wheelZooms(100000, 0)).toBeLessThanOrEqual(1);
  });
});

describe('the end of the zoom', () => {
  it("is reached a hair short of it, where MapLibre's wheel leaves the zoom creeping while it keeps turning", () => {
    expect(atTheEnd(10, 10)).toBe(true);
    expect(atTheEnd(9.97, 10)).toBe(true);
    expect(atTheEnd(-0.15, -0.186)).toBe(true);
  });

  it('is not reached a notch short of it, so a wheel there still zooms the map', () => {
    expect(atTheEnd(9.85, 10)).toBe(false);
    expect(atTheEnd(0, -0.186)).toBe(false);
  });
});

describe('looking round the room', () => {
  const viewport = { width: 1088, height: 900 };
  const covers = (rect: { left: number; top: number; width: number; height: number }) =>
    rect.left <= 1e-6 &&
    rect.top <= 1e-6 &&
    rect.left + rect.width >= viewport.width - 1e-6 &&
    rect.top + rect.height >= viewport.height - 1e-6;

  it('draws back about the middle until it is moved, which is the pull as it always was', () => {
    const pulled = pulledBack(sheetAtFloor(viewport), viewport, 0.5, null);
    expect(pulled.about).toEqual(middleOf(viewport));
    const drawn = scaledAbout(pulled.room, pulled.about, pulled.scale);
    expect(drawn.left).toBeCloseTo(
      pulled.room.left * pulled.scale + (viewport.width * (1 - pulled.scale)) / 2,
    );
  });

  it('moves everything drawn by as much as the pointer moved', () => {
    const pulled = pulledBack(sheetAtFloor(viewport), viewport, 0.5, null);
    const free = 1 - pulled.scale;
    const moved = aboutWithin(pulled.room, viewport, pulled.scale, {
      x: pulled.about.x + 40 / free,
      y: pulled.about.y - 30 / free,
    });
    const before = scaledAbout(pulled.room, pulled.about, pulled.scale);
    const after = scaledAbout(pulled.room, moved, pulled.scale);
    expect(after.left - before.left).toBeCloseTo(40);
    expect(after.top - before.top).toBeCloseTo(-30);
  });

  it('stops at the walls, however far the pointer goes', () => {
    const pulled = pulledBack(sheetAtFloor(viewport), viewport, 0.5, { x: 1e6, y: -1e6 });
    const drawn = scaledAbout(pulled.room, pulled.about, pulled.scale);
    expect(covers(drawn)).toBe(true);
    expect(drawn.left).toBeCloseTo(0);
    expect(drawn.top + drawn.height).toBeCloseTo(viewport.height);
  });

  it('keeps a room narrower than the window in its middle', () => {
    const room = { left: 100, top: -2000, width: 1000, height: 6000 };
    const about = aboutWithin(room, viewport, 0.5, { x: 0, y: 0 });
    const drawn = scaledAbout(room, about, 0.5);
    expect(drawn.left + drawn.width / 2).toBeCloseTo(viewport.width / 2);
  });

  it('moves nothing in at the floor, so the map is handed back exactly as it was left', () => {
    const pulled = pulledBack(sheetAtFloor(viewport), viewport, 0, { x: 5000, y: -5000 });
    expect(scaledAbout(pulled.room, pulled.about, pulled.scale)).toEqual(pulled.room);
  });

  it('sets a dive out from the room it was showing, wherever in it the player was looking', () => {
    const sheet = sheetAtFloor(viewport);
    const looked = { x: 1e6, y: 1e6 };
    const spent = pulledBack(sheet, viewport, 1, looked);
    expect(roomAtTurn(sheet, viewport, looked)).toEqual(scaledAbout(spent.room, spent.about, spent.scale));
  });
});

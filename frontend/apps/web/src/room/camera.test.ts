import { describe, expect, it } from 'vitest';

import { GROUND_LATTICE, frameOf, worldXOf, worldYOf } from '@villages/world';

import { groundTilt, tiltGround } from '../geometry/cameraMath';
import { drawnPoint } from '../map/sheet';

import {
  boxOf,
  coversWindow,
  cssOf,
  liftOf,
  lookBy,
  nearness,
  offsetOf,
  planeOf,
  project,
  towards,
  unproject,
} from './camera';
import type { RoomCamera } from './camera';

/** The camera spent, as the room is seen: drawn back to a quarter, turned 26 and tipped 45, off the middle. */
const SPENT: RoomCamera = { scale: 0.25, about: { x: 610, y: 380 }, turn: 26, tip: 45 };

const AT_REST: RoomCamera = { scale: 1, about: { x: 544, y: 450 }, turn: 0, tip: 0 };

const SOME = [
  { x: 0, y: 0 },
  { x: 1088, y: 0 },
  { x: 300, y: 700 },
  { x: -400, y: 1200 },
];

/** A CSS `matrix` and `transform-origin` applied to a point, as the browser applies them. */
function applyCss(css: { origin: string; transform: string }, point: { x: number; y: number }) {
  const [ox, oy] = css.origin.split(' ').map((part) => Number.parseFloat(part));
  const [a, b, c, d] = (css.transform.match(/-?[\d.e-]+/g) ?? []).map(Number);
  const x = point.x - (ox ?? 0);
  const y = point.y - (oy ?? 0);
  return { x: (ox ?? 0) + (a ?? 0) * x + (c ?? 0) * y, y: (oy ?? 0) + (b ?? 0) * x + (d ?? 0) * y };
}

describe('the room camera at rest', () => {
  it('does nothing at all, so the map is handed back exactly as it was left', () => {
    for (const point of SOME) {
      const there = project(AT_REST, point, 300);
      expect(there.x).toBeCloseTo(point.x);
      expect(there.y).toBeCloseTo(point.y);
    }
    expect(offsetOf({ ...AT_REST, about: { x: 9000, y: -40 } })).toEqual({ x: 0, y: 0 });
  });

  it('has nothing to move when the room is looked round, because there is no room yet', () => {
    expect(lookBy(AT_REST, { x: 40, y: 0 })).toBeNull();
  });
});

describe('the room camera, spent', () => {
  it('draws the scene exactly where the CSS it gives the scene draws it, so the map never leaves its table', () => {
    for (const pitch of [0, 30]) {
      const css = cssOf(SPENT, pitch);
      for (const point of SOME) {
        const byCss = applyCss(css, drawnPoint(point, pitch));
        const byCamera = drawnPoint(project(SPENT, point), pitch);
        expect(byCss.x).toBeCloseTo(byCamera.x, 6);
        expect(byCss.y).toBeCloseTo(byCamera.y, 6);
      }
    }
  });

  it("lays the room's east along the line the map's ground diamonds run at the closest zoom", () => {
    const frame = frameOf(GROUND_LATTICE);
    const ground = tiltGround(
      worldXOf(frame, 1, 0),
      worldYOf(frame, 1, 0),
      groundTilt({ pitch: 45, bearing: 0 }),
    );
    const plane = planeOf({ ...SPENT, turn: GROUND_LATTICE.turn });
    expect(Math.atan2(plane.b, plane.a)).toBeCloseTo(Math.atan2(ground.y, ground.x), 9);
  });

  it('lifts what stands above the table top by the sine of the tip', () => {
    const flat = project(SPENT, { x: 100, y: 100 });
    const raised = project(SPENT, { x: 100, y: 100 }, 80);
    expect(flat.y - raised.y).toBeCloseTo(80 * SPENT.scale * Math.SQRT1_2);
    expect(liftOf({ ...SPENT, tip: 0 })).toBe(0);
  });

  it('finds the point of the table top under the pointer, wherever it has turned and tipped it', () => {
    for (const point of SOME) {
      const back = unproject(SPENT, project(SPENT, point));
      expect(back.x).toBeCloseTo(point.x);
      expect(back.y).toBeCloseTo(point.y);
    }
  });

  it('moves everything drawn by exactly the drag, when the point it is drawn about is moved for it', () => {
    const drag = { x: 37, y: -21 };
    const by = lookBy(SPENT, drag);
    expect(by).not.toBeNull();
    const moved = { ...SPENT, about: { x: SPENT.about.x + (by?.x ?? 0), y: SPENT.about.y + (by?.y ?? 0) } };
    for (const point of SOME) {
      const before = project(SPENT, point);
      const after = project(moved, point);
      expect(after.x - before.x).toBeCloseTo(drag.x);
      expect(after.y - before.y).toBeCloseTo(drag.y);
    }
  });
});

describe('a shape over the window', () => {
  const viewport = { width: 800, height: 600 };

  it('covers it when every corner of the window is inside it, turned or not', () => {
    const square = [
      { x: -10, y: -10 },
      { x: 810, y: -10 },
      { x: 810, y: 610 },
      { x: -10, y: 610 },
    ];
    expect(coversWindow(square, viewport)).toBe(true);
    const turned = square.map((point) =>
      project({ ...SPENT, scale: 2, tip: 0, about: { x: 400, y: 300 } }, point),
    );
    expect(coversWindow(turned, viewport)).toBe(true);
  });

  it('does not when one corner is outside', () => {
    const short = [
      { x: -10, y: -10 },
      { x: 790, y: -10 },
      { x: 810, y: 610 },
      { x: -10, y: 610 },
    ];
    expect(coversWindow(short, viewport)).toBe(false);
  });

  it('has a box round it', () => {
    expect(boxOf(SOME)).toEqual({ left: -400, top: 0, width: 1488, height: 1200 });
  });
});

describe('which faces the camera sees', () => {
  const UP = { east: 0, south: 0, up: 1 };
  const SOUTH = { east: 0, south: 1, up: 0 };
  const NORTH = { east: 0, south: -1, up: 0 };
  const EAST = { east: 1, south: 0, up: 0 };
  const WEST = { east: -1, south: 0, up: 0 };

  it('sees only what faces up when it looks straight down', () => {
    expect(towards(AT_REST, UP)).toBeGreaterThan(0);
    for (const side of [SOUTH, NORTH, EAST, WEST]) {
      expect(towards(AT_REST, side)).toBeCloseTo(0);
    }
  });

  it('sees the south and east sides of a box in the turned room, and not the north and west', () => {
    expect(towards(SPENT, SOUTH)).toBeGreaterThan(0);
    expect(towards(SPENT, EAST)).toBeGreaterThan(0);
    expect(towards(SPENT, NORTH)).toBeLessThan(0);
    expect(towards(SPENT, WEST)).toBeLessThan(0);
  });

  it('counts what is further south, and what stands higher, as nearer', () => {
    const here = { x: 100, y: 100 };
    expect(nearness(SPENT, { x: 100, y: 140 })).toBeGreaterThan(nearness(SPENT, here));
    expect(nearness(SPENT, here, 30)).toBeGreaterThan(nearness(SPENT, here));
  });
});

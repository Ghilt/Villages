import { describe, expect, it } from 'vitest';

import { deskOnScreen } from '../desk/deskTop';
import { floorZoom } from '../map/sheet';
import type { Viewport } from '../map/sheet';
import { worldSize } from '../geometry/cameraMath';

import { boxOf, coversWindow, lookBy, project } from './camera';
import { TABLE_WIDE, floorOf, shellOf, tableOf } from './model';
import {
  aboutWithin,
  atTheEnd,
  middleOf,
  pulledBack,
  roomAtTurn,
  scaleFor,
  sheetAtFloor,
  spanOf,
  tipAt,
  turnsAt,
  wheelZooms,
} from './roomBox';

/** How far the room turns and tips once the pull is spent: the map's ground grid and its closest tilt. */
const MOST = { turn: 26, tip: 45 };

const STAGES: Viewport[] = [
  { width: 1600, height: 900 },
  { width: 1280, height: 720 },
  { width: 928, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

const shellFor = (viewport: Viewport) => shellOf(deskOnScreen(sheetAtFloor(viewport), viewport));

/** The box the floor is drawn in by a pull. */
const drawnFloor = (pulled: ReturnType<typeof pulledBack>) =>
  boxOf(pulled.shell.map((corner) => project(pulled.camera, corner, corner.up)));

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
  it('is laid round the table, which is the desk the map lies on', () => {
    const viewport = { width: 1600, height: 900 };
    const desk = deskOnScreen(sheetAtFloor(viewport), viewport);
    const table = boxOf(tableOf(desk));
    expect(table.left).toBeCloseTo(desk.left);
    expect(table.top).toBeCloseTo(desk.top);
    expect(table.width).toBeCloseTo(desk.width);
    expect(table.height).toBeCloseTo(desk.height);
  });

  it('stops being covered by the desk as the pull draws back, which is when the room is drawn', () => {
    const viewport = { width: 1600, height: 900 };
    const sheet = sheetAtFloor(viewport);
    const desk = (amount: number) => {
      const pulled = pulledBack(sheet, viewport, amount, null, MOST);
      return tableOf(pulled.desk).map((corner) => project(pulled.camera, corner));
    };
    expect(coversWindow(desk(0), viewport)).toBe(true);
    expect(coversWindow(desk(1), viewport)).toBe(false);
  });

  it('has more floor round the table than the two and a half tables each way it was first tried at', () => {
    const viewport = { width: 1088, height: 900 };
    const desk = deskOnScreen(sheetAtFloor(viewport), viewport);
    const floor = boxOf(floorOf(desk));
    expect(floor.width / desk.width).toBeGreaterThan(3);
    expect(floor.height / desk.height).toBeGreaterThan(3);
    expect((floor.width / desk.width) * TABLE_WIDE).toBeCloseTo(7.8);
  });
});

describe('the turn and the tip', () => {
  it("are none at the floor, where the map lies seen from straight above, and the map's own in the room", () => {
    expect(tipAt(0, MOST.tip)).toBe(0);
    expect(tipAt(1, MOST.tip)).toBeCloseTo(MOST.tip);
    expect(tipAt(0.5, MOST.turn)).toBeCloseTo(MOST.turn / 2);
  });

  it("start and stop without a jolt, as the map's own tilt does", () => {
    const step = 1e-6;
    expect(tipAt(step, MOST.tip) / step).toBeLessThan(0.001);
    expect((MOST.tip - tipAt(1 - step, MOST.tip)) / step).toBeLessThan(0.001);
  });

  it('turn and tip the room once the pull is spent, and leave the floor alone', () => {
    const viewport = { width: 1088, height: 900 };
    const atRest = pulledBack(sheetAtFloor(viewport), viewport, 0, null, MOST).camera;
    expect([atRest.scale, atRest.turn, atRest.tip]).toEqual([1, 0, 0]);
    const spent = pulledBack(sheetAtFloor(viewport), viewport, 1, null, MOST).camera;
    expect(spent.turn).toBeCloseTo(MOST.turn);
    expect(spent.tip).toBeCloseTo(MOST.tip);
  });
});

describe('the turn of the pull', () => {
  it('fills the window top to bottom when the camera jumps, the walls rising past its top', () => {
    for (const viewport of STAGES) {
      const { box } = roomAtTurn(sheetAtFloor(viewport), viewport, null, MOST);
      expect(box.top).toBeLessThan(0);
      expect(box.top + box.height).toBeGreaterThanOrEqual(viewport.height - 1e-6);
      // Across, it reaches both sides where it is wider than the window, and stands in the middle where it is not.
      if (box.width >= viewport.width) {
        expect(box.left).toBeLessThanOrEqual(1e-6);
        expect(box.left + box.width).toBeGreaterThanOrEqual(viewport.width - 1e-6);
      } else {
        expect(box.left + box.width / 2).toBeCloseTo(viewport.width / 2);
      }
    }
  });

  it('arrives looking at the table, near the middle of the window, when nobody has looked round', () => {
    for (const viewport of STAGES) {
      const spent = pulledBack(sheetAtFloor(viewport), viewport, 1, null, MOST);
      const table = boxOf(tableOf(spent.desk).map((corner) => project(spent.camera, corner)));
      expect(Math.abs(table.left + table.width / 2 - viewport.width / 2)).toBeLessThan(viewport.width * 0.1);
      expect(Math.abs(table.top + table.height / 2 - viewport.height / 2)).toBeLessThan(
        viewport.height * 0.1,
      );
    }
  });

  it('is a journey of between one and three zoom levels on every shape the stage can be', () => {
    for (const viewport of STAGES) {
      const span = spanOf(turnsAt(shellFor(viewport), viewport, MOST));
      expect(span).toBeGreaterThanOrEqual(1.2);
      expect(span).toBeLessThanOrEqual(2.6);
    }
  });
});

describe('the scale a pull comes to', () => {
  it('is one at rest, and the scale the turn happens at when it is spent', () => {
    const wide = { width: 1600, height: 900 };
    const turn = turnsAt(shellFor(wide), wide, MOST);
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
  const sheet = sheetAtFloor(viewport);

  it('draws back about the middle until it is moved', () => {
    const pulled = pulledBack(sheet, viewport, 0.8, null, MOST);
    expect(pulled.camera.about.x).toBeCloseTo(middleOf(viewport).x);
    expect(pulled.camera.about.y).toBeCloseTo(middleOf(viewport).y);
  });

  it('moves everything drawn by as much as the pointer moved, turned and tipped', () => {
    const pulled = pulledBack(sheet, viewport, 0.8, null, MOST);
    const drag = { x: 40, y: -30 };
    const by = lookBy(pulled.camera, drag);
    expect(by).not.toBeNull();
    const camera = {
      ...pulled.camera,
      about: { x: pulled.camera.about.x + (by?.x ?? 0), y: pulled.camera.about.y + (by?.y ?? 0) },
    };
    const moved = aboutWithin(pulled.shell, viewport, camera);
    const before = project(pulled.camera, pulled.shell[0] ?? { x: 0, y: 0 });
    const after = project({ ...camera, about: moved }, pulled.shell[0] ?? { x: 0, y: 0 });
    expect(after.x - before.x).toBeCloseTo(drag.x);
    expect(after.y - before.y).toBeCloseTo(drag.y);
  });

  it("stops at the floor's edges, however far the pointer goes", () => {
    const pulled = pulledBack(sheet, viewport, 0.8, { x: 1e6, y: -1e6 }, MOST);
    const box = drawnFloor(pulled);
    expect(box.left).toBeLessThanOrEqual(1e-6);
    expect(box.top).toBeLessThanOrEqual(1e-6);
    expect(box.left + box.width).toBeGreaterThanOrEqual(viewport.width - 1e-6);
    expect(box.top + box.height).toBeGreaterThanOrEqual(viewport.height - 1e-6);
    // Pushed as far as it goes one way, an edge of the floor is on an edge of the window.
    expect(Math.min(Math.abs(box.left), Math.abs(box.left + box.width - viewport.width))).toBeCloseTo(0);
  });

  it('moves nothing in at the floor, so the map is handed back exactly as it was left', () => {
    const pulled = pulledBack(sheet, viewport, 0, { x: 5000, y: -5000 }, MOST);
    for (const corner of pulled.shell) {
      const drawn = project(pulled.camera, corner);
      expect(drawn.x).toBeCloseTo(corner.x);
      expect(drawn.y).toBeCloseTo(corner.y);
    }
  });

  it('sets a dive out from the room it was showing, wherever in it the player was looking', () => {
    const looked = { x: 1e6, y: 1e6 };
    const spent = pulledBack(sheet, viewport, 1, looked, MOST);
    const room = roomAtTurn(sheet, viewport, looked, MOST);
    expect(room.camera).toEqual(spent.camera);
    expect(room.box).toEqual(drawnFloor(spent));
  });
});

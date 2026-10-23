import { describe, expect, it } from 'vitest';

import { drawnAt, flatWindow } from '../map/sheet';
import type { Viewport } from '../map/sheet';

import {
  DIVE_MS,
  carried,
  castleHeight,
  keepAbove,
  keepAt,
  overTheHolding,
  railFrom,
  roomAt,
  scaleAt,
  sceneAt,
  solidAt,
  spanTo,
  lightAt,
} from './dive';
import { boxOf, project } from './camera';
import type { Dive } from './dive';
import { pulledBack, roomAtTurn, sheetAtFloor } from './roomBox';

const STAGES: Viewport[] = [
  { width: 1600, height: 900 },
  { width: 1088, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

/** How far the map is tipped at its closest zoom, and so how far the room tips once the pull is spent. */
const TIP = 45;

/** And how far the room turns: the ground grid's own turn. */
const MOST = { turn: 26, tip: TIP };

/**
 * A dive into a castle standing a little off the middle, as one the player has not centred would be: worked
 * out in the closest zoom's flat window, ending in the room the pull draws at the floor, looking straight down.
 */
function diveIn(viewport: Viewport, about: { x: number; y: number } | null = null): Dive {
  const flat = flatWindow(viewport, TIP);
  const foot = { x: flat.width / 2 + 40, y: flat.height / 2 + 30 };
  const room = roomAtTurn(sheetAtFloor(viewport), viewport, about, MOST);
  const end = carried(room.box, 0, TIP);
  return {
    going: 'in',
    progress: 0,
    keep: keepAbove(foot, 10),
    span: spanTo(end),
    end,
    room: { ...room, pitch: 0 },
  };
}

describe('the castle', () => {
  it('stands 128 pixels at the closest zoom, as a castle of the first level does', () => {
    expect(castleHeight(10)).toBeCloseTo(128);
  });

  it('is turned about its middle, half its height above the seat its foot stands on', () => {
    expect(keepAbove({ x: 100, y: 200 }, 10)).toEqual({ x: 100, y: 200 - 64 });
  });
});

describe('the way in', () => {
  it('is there when the castle is what you are looking at', () => {
    const viewport = { width: 1088, height: 900 };
    expect(overTheHolding({ x: 544, y: 450 }, viewport)).toBe(true);
    expect(overTheHolding({ x: 544 + 100, y: 450 - 80 }, viewport)).toBe(true);
  });

  it('is not there when it is off in a corner, where the closest zoom is just the end of the zoom', () => {
    const viewport = { width: 1088, height: 900 };
    expect(overTheHolding({ x: 40, y: 40 }, viewport)).toBe(false);
    expect(overTheHolding({ x: 1040, y: 860 }, viewport)).toBe(false);
  });
});

describe('the passage', () => {
  it('starts as the identity, so the first frame of it changes nothing at all', () => {
    for (const viewport of STAGES) {
      const dive = diveIn(viewport);
      const { slide, scale } = sceneAt(dive, 0);
      expect(scale).toBeCloseTo(1);
      expect(slide.x).toBeCloseTo(0);
      expect(slide.y).toBeCloseTo(0);
    }
  });

  it('brings the castle to the middle of the room it lands in, near the middle of the window', () => {
    for (const viewport of STAGES) {
      const flat = flatWindow(viewport, TIP);
      const dive = diveIn(viewport);
      const there = keepAt(dive, 1);
      expect(there.x).toBeCloseTo(dive.end.left + dive.end.width / 2);
      expect(there.y).toBeCloseTo(dive.end.top + dive.end.height / 2);
      expect(Math.abs(there.x - flat.width / 2)).toBeLessThan(flat.width * 0.05);
      expect(Math.abs(there.y - flat.height / 2)).toBeLessThan(flat.height * 0.05);
    }
  });

  it('leaves the room exactly where the real one is about to be, which is what hides the jump', () => {
    for (const viewport of STAGES) {
      // A room looked round to one wall as well as one nobody has, because a dive out sets out from either.
      for (const about of [null, { x: 1e6, y: -1e6 }]) {
        const dive = diveIn(viewport, about);
        const landed = roomAt(dive, 1);
        expect(landed.left).toBeCloseTo(dive.end.left);
        expect(landed.top).toBeCloseTo(dive.end.top);
        expect(landed.width).toBeCloseTo(dive.end.width);
        expect(landed.height).toBeCloseTo(dive.end.height);
      }
    }
  });

  it('ends in the box the pull draws the room in, turned and tipped, so the camera moves under the same room', () => {
    for (const viewport of STAGES) {
      const spent = pulledBack(sheetAtFloor(viewport), viewport, 1, null, MOST);
      const room = boxOf(spent.floor.map((corner) => project(spent.camera, corner)));
      const inTheCastle = drawnAt(roomAt(diveIn(viewport), 1), TIP);
      expect(inTheCastle.left).toBeCloseTo(room.left);
      expect(inTheCastle.top).toBeCloseTo(room.top);
      expect(inTheCastle.width).toBeCloseTo(room.width);
      expect(inTheCastle.height).toBeCloseTo(room.height);
    }
  });

  it('carries the room it ends in, so the picture inside the castle is drawn by the camera the pull draws with', () => {
    const viewport = { width: 1088, height: 900 };
    const { room } = diveIn(viewport);
    const spent = pulledBack(sheetAtFloor(viewport), viewport, 1, null, MOST);
    expect(room.camera).toEqual(spent.camera);
    expect(room.desk).toEqual(spent.desk);
  });

  it('starts with the room inside the castle rather than around it', () => {
    const viewport = { width: 1088, height: 900 };
    const dive = diveIn(viewport);
    const begun = roomAt(dive, 0);
    expect(begun.width).toBeLessThan(castleHeight(10));
    expect(begun.left + begun.width / 2).toBeCloseTo(dive.keep.x);
    expect(begun.top + begun.height / 2).toBeCloseTo(dive.keep.y);
  });

  it('keeps the room the shape the real one is, so nothing is squashed on the way', () => {
    const viewport = { width: 390, height: 844 };
    const dive = diveIn(viewport);
    const shape = dive.end.width / dive.end.height;
    for (const progress of [0, 0.3, 0.7, 1]) {
      const rect = roomAt(dive, progress);
      expect(rect.width / rect.height).toBeCloseTo(shape);
    }
  });

  it('goes far enough into the pixels that a castle is bigger than the window', () => {
    for (const viewport of STAGES) {
      const dive = diveIn(viewport);
      expect(castleHeight(10) * dive.span).toBeGreaterThan(Math.max(viewport.width, viewport.height));
    }
  });

  it('scales exponentially, so it reads as zoom and not as a thing being inflated', () => {
    const viewport = { width: 1088, height: 900 };
    const dive = diveIn(viewport);
    const quarter = scaleAt(dive, 0.25);
    const half = scaleAt(dive, 0.5);
    expect(half / quarter).toBeCloseTo(quarter);
    expect(scaleAt(dive, 1)).toBeCloseTo(dive.span);
  });

  it('closes the picture down to nothing by the end, so the edges of the room do not flicker', () => {
    expect(lightAt(0)).toBe(1);
    expect(lightAt(0.8)).toBe(1);
    expect(lightAt(1)).toBe(0);
    expect(lightAt(0.91)).toBeCloseTo(0.5);
  });

  it('brings the room up from nothing, so it is never a blob painted on the sprite', () => {
    expect(solidAt(0)).toBe(0);
    expect(solidAt(0.05)).toBeLessThan(0.3);
    expect(solidAt(0.25)).toBe(1);
    expect(solidAt(1)).toBe(1);
  });
});

describe('the rail', () => {
  it('runs the whole way in a little over half a second, half again as fast as it was', () => {
    expect(DIVE_MS).toBeCloseTo(850 / 1.5, 0);
    expect(railFrom(0, 'in', DIVE_MS)).toBe(1);
    expect(railFrom(1, 'out', DIVE_MS)).toBe(0);
    expect(railFrom(0, 'in', DIVE_MS / 2)).toBeCloseTo(0.5);
  });

  it('turns round from wherever it has got to, and goes back from there', () => {
    const halfway = railFrom(0, 'in', DIVE_MS * 0.3);
    expect(railFrom(halfway, 'out', DIVE_MS * 0.1)).toBeCloseTo(0.2);
    expect(railFrom(halfway, 'out', DIVE_MS)).toBe(0);
  });

  it('never runs past either end, nor backwards in time', () => {
    expect(railFrom(0.9, 'in', DIVE_MS)).toBe(1);
    expect(railFrom(0.1, 'out', DIVE_MS)).toBe(0);
    expect(railFrom(0.4, 'in', -50)).toBeCloseTo(0.4);
  });
});

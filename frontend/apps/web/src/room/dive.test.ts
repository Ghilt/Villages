import { describe, expect, it } from 'vitest';

import type { Viewport } from '../map/sheet';

import {
  castleHeight,
  keepAbove,
  keepAt,
  overTheHolding,
  roomAt,
  scaleAt,
  sceneAt,
  solidAt,
  spanTo,
  lightAt,
} from './dive';
import type { Dive } from './dive';
import { roomAtTurn, sheetAtFloor } from './roomBox';

const STAGES: Viewport[] = [
  { width: 1600, height: 900 },
  { width: 1088, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

/** A dive into a castle standing a little off the middle, as one the player has not centred would be. */
function diveIn(
  viewport: Viewport,
  foot = { x: viewport.width / 2 + 40, y: viewport.height / 2 + 30 },
): Dive {
  const end = roomAtTurn(sheetAtFloor(viewport), viewport);
  return { going: 'in', progress: 0, keep: keepAbove(foot, 10), span: spanTo(end), end };
}

describe('the castle', () => {
  it('stands 64 pixels at the closest zoom, which is what decision 0051 says', () => {
    expect(castleHeight(10)).toBeCloseTo(64);
  });

  it('is turned about its middle, half its height above the seat its foot stands on', () => {
    expect(keepAbove({ x: 100, y: 200 }, 10)).toEqual({ x: 100, y: 200 - 32 });
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
      const { slide, scale } = sceneAt(dive, viewport, 0);
      expect(scale).toBeCloseTo(1);
      expect(slide.x).toBeCloseTo(0);
      expect(slide.y).toBeCloseTo(0);
    }
  });

  it('brings the castle to the middle of the window by the end', () => {
    for (const viewport of STAGES) {
      const dive = diveIn(viewport);
      const there = keepAt(dive, viewport, 1);
      expect(there.x).toBeCloseTo(viewport.width / 2);
      expect(there.y).toBeCloseTo(viewport.height / 2);
    }
  });

  it('leaves the room exactly where the real one is about to be, which is what hides the jump', () => {
    for (const viewport of STAGES) {
      const dive = diveIn(viewport);
      const landed = roomAt(dive, viewport, 1);
      expect(landed.left).toBeCloseTo(dive.end.left);
      expect(landed.top).toBeCloseTo(dive.end.top);
      expect(landed.width).toBeCloseTo(dive.end.width);
      expect(landed.height).toBeCloseTo(dive.end.height);
    }
  });

  it('starts with the room inside the castle rather than around it', () => {
    const viewport = { width: 1088, height: 900 };
    const dive = diveIn(viewport);
    const begun = roomAt(dive, viewport, 0);
    expect(begun.width).toBeLessThan(castleHeight(10));
    expect(begun.left + begun.width / 2).toBeCloseTo(dive.keep.x);
    expect(begun.top + begun.height / 2).toBeCloseTo(dive.keep.y);
  });

  it('keeps the room the shape the real one is, so nothing is squashed on the way', () => {
    const viewport = { width: 390, height: 844 };
    const dive = diveIn(viewport);
    const shape = dive.end.width / dive.end.height;
    for (const progress of [0, 0.3, 0.7, 1]) {
      const rect = roomAt(dive, viewport, progress);
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

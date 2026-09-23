import { describe, expect, it } from 'vitest';

import { CAMERA } from '../../map/mapConfig';
import { KINDS } from './kinds';
import { CELL } from './scatter';
import {
  FADE,
  MOST_CELLS,
  SPREAD,
  alphaAt,
  nothingBelow,
  nothingBelowAny,
  wholeAt,
  worthDrawing,
} from './showing';

/** How many cells a view of this size holds at a zoom, which is what the bounds are about. */
function cellsInView(zoom: number, width = 1400, height = 900): number {
  const across = CELL * 2 ** (zoom - 6);
  return (Math.ceil(width / across) + 2) * (Math.ceil(height / across) + 2);
}

describe('when scenery is worth drawing at all', () => {
  it('draws nothing at the zoom the camera opens on', () => {
    // The regression this exists for. A cell is eight screen pixels at zoom 4, so the view held about
    // twenty thousand of them and five million points behind those, and the page hung before the map
    // had drawn. Nothing about the fade caught it, because a fade says how much, not whether.
    expect(worthDrawing(CAMERA.initialZoom, cellsInView(CAMERA.initialZoom))).toBe(false);
    expect(CAMERA.initialZoom).toBeLessThan(nothingBelowAny());
  });

  it('draws nothing however small the view, below the zoom anything would show', () => {
    const floor = nothingBelowAny();

    expect(worthDrawing(floor - 0.01, 1)).toBe(false);
    expect(worthDrawing(floor, 1)).toBe(true);
  });

  it('refuses a view holding more cells than it will hold, however far in the camera is', () => {
    expect(worthDrawing(10, MOST_CELLS)).toBe(true);
    expect(worthDrawing(10, MOST_CELLS + 1)).toBe(false);
  });

  it('only ever refuses ground that would have been drawn empty anyway', () => {
    // The claim the cell cap rests on. If it ever refused a view where something had begun to show,
    // scenery would arrive in a step rather than gathering - which is the fault 0051 is against.
    for (let zoom = nothingBelowAny(); zoom <= 10; zoom += 0.02) {
      if (worthDrawing(zoom, cellsInView(zoom))) {
        continue;
      }
      // Refused: so nothing of any kind, at any rank, may have anything showing here.
      for (const kind of KINDS) {
        expect(alphaAt(zoom, kind.groundHeight, 1, 0)).toBe(0);
      }
    }
  });
});

describe('how a kind arrives', () => {
  it('is whole once it is big enough to read, and nothing before its own start', () => {
    const pine = KINDS[0]!.groundHeight;

    expect(alphaAt(wholeAt(pine), pine, 1)).toBeCloseTo(1, 9);
    expect(alphaAt(nothingBelow(pine), pine, 1)).toBe(0);
    expect(alphaAt(nothingBelow(pine) - 1, pine, 0)).toBe(0);
  });

  it('lets the lowest ranks in first, so a wood thickens rather than appearing', () => {
    const pine = KINDS[0]!.groundHeight;
    const partWay = wholeAt(pine) - SPREAD;

    expect(alphaAt(partWay, pine, 0)).toBeGreaterThan(alphaAt(partWay, pine, 1));
  });

  it('has every kind whole by the closest the camera comes, or it is never seen whole', () => {
    for (const kind of KINDS) {
      expect(wholeAt(kind.groundHeight)).toBeLessThanOrEqual(CAMERA.maxZoom);
    }
  });

  it('only ever moves one way as the camera comes in', () => {
    const oak = KINDS[1]!.groundHeight;
    let last = -1;
    for (let zoom = 0; zoom <= 10; zoom += 0.05) {
      const now = alphaAt(zoom, oak, 0.4);
      expect(now).toBeGreaterThanOrEqual(last - 1e-12);
      last = now;
    }
  });

  it('is pushed back together by the one knob that is a matter of taste', () => {
    const pine = KINDS[0]!.groundHeight;

    expect(wholeAt(pine, 1)).toBeCloseTo(wholeAt(pine) + 1, 9);
    expect(nothingBelowAny(1)).toBeCloseTo(nothingBelowAny() + 1, 9);
    expect(FADE).toBeGreaterThan(0);
  });
});

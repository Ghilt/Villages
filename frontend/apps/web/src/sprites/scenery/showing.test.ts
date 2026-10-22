import { describe, expect, it } from 'vitest';

import { CAMERA } from '../../map/mapConfig';
import { BECOMES_A_MARK_AT, CROSSOVER_STICK, LONGEST_STEP_MS, PRESENCE_MS, easeTowards } from '../twoForms';
import { CELL } from '@villages/world';
import { EXAMPLE_KINDS as KINDS } from '@villages/world/testing';
import {
  BUILT_AHEAD,
  MOST_CELLS,
  STEPS,
  groupCount,
  groupOf,
  nearestFirst,
  nothingBelowAny,
  thresholdOf,
  wantedAt,
  worthBuilding,
} from './showing';

/** How many cells a view of this size holds at a zoom, which is what the bounds are about. */
function cellsInView(zoom: number, width = 1400, height = 900): number {
  const across = CELL * 2 ** (zoom - 6);
  return (Math.ceil(width / across) + 2) * (Math.ceil(height / across) + 2);
}

describe('when the woods are worth building at all', () => {
  it('builds nothing at the zoom the camera opens on', () => {
    // The regression this exists for. A cell is eight screen pixels at zoom 4, so the view held about
    // twenty thousand of them and five million points behind those, and the page hung before the map
    // had drawn. Nothing about the fade caught it, because a fade says how much, not whether.
    expect(worthBuilding(KINDS, CAMERA.initialZoom, cellsInView(CAMERA.initialZoom))).toBe(false);
    expect(CAMERA.initialZoom).toBeLessThan(nothingBelowAny(KINDS) - BUILT_AHEAD);
  });

  it('builds them half a zoom before they arrive, so the crossing only fades them in', () => {
    const from = nothingBelowAny(KINDS) - BUILT_AHEAD;

    expect(worthBuilding(KINDS, from - 0.01, 1)).toBe(false);
    expect(worthBuilding(KINDS, from, 1)).toBe(true);
  });

  it('keeps them built while the camera rests on that zoom, and tears them down once it has gone past', () => {
    const from = nothingBelowAny(KINDS) - BUILT_AHEAD;

    expect(worthBuilding(KINDS, from - CROSSOVER_STICK / 2, 1, true)).toBe(true);
    expect(worthBuilding(KINDS, from - CROSSOVER_STICK - 0.01, 1, true)).toBe(false);
  });

  it('has room for a large screen’s view where they are built', () => {
    expect(
      cellsInView(nothingBelowAny(KINDS) - BUILT_AHEAD - CROSSOVER_STICK, 2560, 1440),
    ).toBeLessThanOrEqual(MOST_CELLS);
  });

  it('refuses a view holding more cells than it will hold, however far in the camera is', () => {
    expect(worthBuilding(KINDS, 10, MOST_CELLS)).toBe(true);
    expect(worthBuilding(KINDS, 10, MOST_CELLS + 1)).toBe(false);
  });

  it('only ever refuses ground where no group has arrived anyway', () => {
    // The claim the cell cap rests on. If it ever refused a view where something had begun to arrive,
    // scenery would vanish in a step rather than fading - which is the fault 0051 is against.
    for (let zoom = nothingBelowAny(KINDS); zoom <= 10; zoom += 0.02) {
      if (worthBuilding(KINDS, zoom, cellsInView(zoom))) {
        continue;
      }
      for (let group = 0; group < groupCount(KINDS); group += 1) {
        expect(wantedAt(thresholdOf(KINDS, group), zoom, false)).toBe(false);
      }
    }
  });
});

describe('a group, which is what arrives', () => {
  it('is a kind: every point of it arrives at once', () => {
    expect(STEPS).toBe(1);
    expect(groupOf(0, 0)).toBe(0);
    expect(groupOf(0, 0.99)).toBe(0);
    expect(groupOf(3, 1)).toBe(3);
    expect(groupCount(KINDS)).toBe(KINDS.length);
  });

  it('arrives at the zoom everything on the map changes over at, whatever its size', () => {
    const big = KINDS.findIndex((kind) => kind.name === 'spruce');
    const small = KINDS.findIndex((kind) => kind.name === 'heather');
    expect(thresholdOf(KINDS, big)).toBe(BECOMES_A_MARK_AT);
    expect(thresholdOf(KINDS, small)).toBe(BECOMES_A_MARK_AT);
    for (let group = 0; group < groupCount(KINDS); group += 1) {
      expect(thresholdOf(KINDS, group)).toBe(BECOMES_A_MARK_AT);
    }
  });

  it('is pushed back together by the one knob that is a matter of taste', () => {
    expect(thresholdOf(KINDS, 0, 1)).toBeCloseTo(thresholdOf(KINDS, 0) + 1, 9);
    expect(nothingBelowAny(KINDS, 1)).toBeCloseTo(nothingBelowAny(KINDS) + 1, 9);
  });
});

describe('the zoom decides whether, and time decides how long', () => {
  const threshold = thresholdOf(KINDS, 0);

  it('takes a group in above its threshold and leaves it out below', () => {
    expect(wantedAt(threshold, threshold + 1, false)).toBe(true);
    expect(wantedAt(threshold, threshold - 1, true)).toBe(false);
  });

  it('holds a group still while the camera rests on its threshold', () => {
    // Without the stick a camera parked on a threshold starts a fresh fade on every jitter of the wheel,
    // which is a screen of scenery breathing. Out stays out and in stays in, right across the join.
    expect(wantedAt(threshold, threshold, false)).toBe(false);
    expect(wantedAt(threshold, threshold, true)).toBe(true);
    expect(CROSSOVER_STICK).toBeGreaterThan(0);
  });

  it('finishes, wherever the camera stops', () => {
    // The whole reason this stopped being a function of zoom. Resting inside a band of zoom left a
    // screen of half-drawn trees for as long as you cared to look at it; a fade in time always lands.
    let alpha = 0;
    for (let step = 0; step < 100 && alpha < 1; step += 1) {
      alpha = easeTowards(alpha, 1, LONGEST_STEP_MS, PRESENCE_MS);
    }
    expect(alpha).toBe(1);
  });

  it('never finishes in one frame, however long the frame was', () => {
    // A still map draws nothing, so the gap since its last frame is often seconds. Handed that whole
    // gap, a group arriving would pop - which is the thing the fade is for.
    expect(LONGEST_STEP_MS).toBeLessThan(PRESENCE_MS);
    expect(easeTowards(0, 1, LONGEST_STEP_MS, PRESENCE_MS)).toBeLessThan(1);
  });

  it('takes about as long as a mark takes to arrive, whatever the zoom did', () => {
    const frames = Math.ceil(PRESENCE_MS / LONGEST_STEP_MS);
    let alpha = 0;
    for (let step = 0; step < frames; step += 1) {
      alpha = easeTowards(alpha, 1, LONGEST_STEP_MS, PRESENCE_MS);
    }
    expect(alpha).toBe(1);
  });
});

describe('the order the woods are built in', () => {
  it('is the middle of the view first, so what the camera comes in on is ready before the edges', () => {
    const cells = nearestFirst(0, 4, 0, 2);
    expect(cells).toHaveLength(15);
    expect(cells[0]).toEqual({ x: 2, y: 1 });
    expect(cells.slice(-4)).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 2 },
        { x: 4, y: 2 },
      ]),
    );
  });
});

import { describe, expect, it } from 'vitest';

import { CAMERA } from '../../map/mapConfig';
import { CROSSOVER_STICK, LONGEST_STEP_MS, PRESENCE_MS, easeTowards } from '../twoForms';
import { KINDS } from './fixture';
import { CELL } from './scatter';
import {
  MOST_CELLS,
  SPREAD,
  STEPS,
  groupCount,
  groupOf,
  nothingBelowAny,
  thresholdOf,
  wantedAt,
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
    expect(worthDrawing(KINDS, CAMERA.initialZoom, cellsInView(CAMERA.initialZoom))).toBe(false);
    expect(CAMERA.initialZoom).toBeLessThan(nothingBelowAny(KINDS));
  });

  it('draws nothing however small the view, below the zoom anything would show', () => {
    const floor = nothingBelowAny(KINDS);

    expect(worthDrawing(KINDS, floor - 0.01, 1)).toBe(false);
    expect(worthDrawing(KINDS, floor, 1)).toBe(true);
  });

  it('refuses a view holding more cells than it will hold, however far in the camera is', () => {
    expect(worthDrawing(KINDS, 10, MOST_CELLS)).toBe(true);
    expect(worthDrawing(KINDS, 10, MOST_CELLS + 1)).toBe(false);
  });

  it('only ever refuses ground where no group has arrived anyway', () => {
    // The claim the cell cap rests on. If it ever refused a view where something had begun to arrive,
    // scenery would vanish in a step rather than fading - which is the fault 0051 is against.
    for (let zoom = nothingBelowAny(KINDS); zoom <= 10; zoom += 0.02) {
      if (worthDrawing(KINDS, zoom, cellsInView(zoom))) {
        continue;
      }
      for (let group = 0; group < groupCount(KINDS); group += 1) {
        expect(wantedAt(thresholdOf(KINDS, group), zoom, false)).toBe(false);
      }
    }
  });
});

describe('a group, which is what arrives', () => {
  it('puts every point of a kind in one of its steps, by rank', () => {
    expect(groupOf(0, 0)).toBe(0);
    expect(groupOf(0, 0.99)).toBe(STEPS - 1);
    expect(groupOf(1, 0)).toBe(STEPS);
    // A rank of exactly one would fall off the end, and a hash may return anything under one.
    expect(groupOf(3, 1)).toBe(3 * STEPS + STEPS - 1);
    expect(groupCount(KINDS)).toBe(KINDS.length * STEPS);
  });

  it('brings a kind in over a band of zoom, earliest step first, ending at its own zoom', () => {
    const tall = KINDS[0]!.groundHeight;
    expect(thresholdOf(KINDS, 0)).toBeCloseTo(wholeAt(tall) - SPREAD, 9);
    expect(thresholdOf(KINDS, STEPS - 1)).toBeCloseTo(wholeAt(tall), 9);
    for (let step = 1; step < STEPS; step += 1) {
      expect(thresholdOf(KINDS, step)).toBeGreaterThan(thresholdOf(KINDS, step - 1));
    }
  });

  it('brings a big kind in before a small one', () => {
    const big = KINDS.findIndex((kind) => kind.name === 'spruce');
    const small = KINDS.findIndex((kind) => kind.name === 'heather');
    expect(thresholdOf(KINDS, big * STEPS)).toBeLessThan(thresholdOf(KINDS, small * STEPS));
  });

  it('has every kind whole by the closest the camera comes, or it is never seen whole', () => {
    for (const kind of KINDS) {
      expect(wholeAt(kind.groundHeight)).toBeLessThanOrEqual(CAMERA.maxZoom);
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

import { describe, expect, it } from 'vitest';

import {
  BRIDGE_LENGTH,
  BRIDGE_WAYS,
  WAY_STEPS,
  bridgeTriangles,
  deckAt,
  piers,
  soffitAt,
} from './bridgeModel.ts';
import { renderBridge } from './bridgeRender.ts';

describe('the bridge as modelled', () => {
  it('runs its whole length and no further, the same both ways from its middle', () => {
    const along = bridgeTriangles().flatMap(({ at }) => at.map(([s]) => s));
    expect(Math.min(...along)).toBeCloseTo(-BRIDGE_LENGTH / 2, 9);
    expect(Math.max(...along)).toBeCloseTo(BRIDGE_LENGTH / 2, 9);
  });

  it('is highest at its middle and comes down to the road at its ends', () => {
    expect(deckAt(0)).toBeGreaterThan(deckAt(1));
    expect(deckAt(BRIDGE_LENGTH / 2)).toBeLessThan(0.15);
    expect(deckAt(-1)).toBeCloseTo(deckAt(1), 9);
  });

  it('carries its deck over its arches, never through them, on piers standing on the ground', () => {
    for (let s = -BRIDGE_LENGTH / 2; s <= BRIDGE_LENGTH / 2; s += 0.01) {
      expect(deckAt(s) - soffitAt(s), `at ${s.toFixed(2)}`).toBeGreaterThan(0);
    }
    for (const [from, to] of piers()) {
      expect(soffitAt((from + to) / 2)).toBe(0);
    }
  });
});

describe('the eight ways a bridge runs', () => {
  it('are whole steps of the lattice, each its own direction, none the other end of another', () => {
    const angles = BRIDGE_WAYS.map((way) => {
      const [u, v] = WAY_STEPS[way];
      return ((Math.atan2(v, u) * 180) / Math.PI + 180) % 180;
    });
    expect(new Set(angles.map((angle) => angle.toFixed(3))).size).toBe(8);
    // In order round the half-turn, never more than 27 degrees apart.
    const sorted = [...angles].sort((one, other) => one - other);
    expect(sorted).toEqual(angles);
    for (let at = 1; at < sorted.length; at += 1) expect(sorted[at]! - sorted[at - 1]!).toBeLessThan(27);
  });
});

describe('the bridge drawn', () => {
  it('along every way stands on the middle of its picture, where the middle of its deck meets the ground', () => {
    for (const way of BRIDGE_WAYS) {
      const picture = renderBridge(way, 12, 1);
      expect(picture.width % 2, way).toBe(0);
      expect(picture.height % 2, way).toBe(0);
      // Straight above the middle, the deck: drawn, and nothing drawn at the picture's very corners.
      const solid = (x: number, y: number) => picture.data[(y * picture.width + x) * 4 + 3]! > 0;
      const middleX = picture.width / 2;
      const deckY = Math.round(picture.height / 2 - deckAt(0) * Math.SQRT1_2 * 12);
      expect(solid(middleX, deckY), way).toBe(true);
      expect(solid(0, 0) || solid(picture.width - 1, picture.height - 1), way).toBe(false);
    }
  });
});

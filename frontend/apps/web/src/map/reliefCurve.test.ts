import { describe, expect, it } from 'vitest';

import { steepenedAt, strengthAt, strengthByZoom } from './reliefCurve';

const CURVE = { far: 1, near: 0.2, from: 6, to: 9 };

describe('the relief by zoom', () => {
  it('is the far strength out to its zoom and the near one from its zoom in', () => {
    expect(strengthAt(CURVE, 2)).toBe(1);
    expect(strengthAt(CURVE, 6)).toBe(1);
    expect(strengthAt(CURVE, 9)).toBeCloseTo(0.2);
    expect(strengthAt(CURVE, 10)).toBeCloseTo(0.2);
  });

  it('eases between, halfway at the middle and never past either end', () => {
    expect(strengthAt(CURVE, 7.5)).toBeCloseTo(0.6);
    for (let zoom = 6; zoom <= 9; zoom += 0.25) {
      expect(strengthAt(CURVE, zoom)).toBeLessThanOrEqual(1 + 1e-9);
      expect(strengthAt(CURVE, zoom)).toBeGreaterThanOrEqual(0.2 - 1e-9);
    }
  });

  it('can rise as well as fall, and stands still where the two zooms meet', () => {
    expect(strengthAt({ far: 0, near: 1, from: 5, to: 7 }, 7)).toBe(1);
    expect(strengthAt({ far: 1, near: 0, from: 8, to: 8 }, 7.99)).toBe(1);
    expect(strengthAt({ far: 1, near: 0, from: 8, to: 8 }, 8.01)).toBe(0);
  });

  it('becomes a MapLibre expression with stops in rising zoom that lands on the curve', () => {
    const expression = strengthByZoom(CURVE, (strength) => strength);
    expect(expression.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']]);
    const stops = expression.slice(3) as number[];
    for (let i = 0; i < stops.length; i += 2) {
      expect(stops[i + 1]).toBeCloseTo(strengthAt(CURVE, stops[i]!));
      if (i > 0) expect(stops[i]).toBeGreaterThan(stops[i - 2]!);
    }
    expect(stops[0]).toBe(6);
    expect(stops.at(-2)).toBe(9);
  });

  it('steepens the ground the further out, as MapLibre does, so a range still shows on the continent', () => {
    expect(steepenedAt(14)).toBe(1);
    expect(steepenedAt(5)).toBeCloseTo(6.5, 1);
    expect(steepenedAt(10)).toBeCloseTo(2.3, 1);
    expect(steepenedAt(4)).toBeGreaterThan(steepenedAt(5));
  });
});

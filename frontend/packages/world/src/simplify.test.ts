import { describe, expect, it } from 'vitest';

import { doubleSignedArea, simplify, smooth } from './simplify.ts';
import type { Ring } from './trace.ts';

const staircase = (steps: number): Ring => {
  const ring: Ring = [{ x: 0, y: 0 }];
  for (let step = 0; step < steps; step += 1) {
    ring.push({ x: step + 1, y: step }, { x: step + 1, y: step + 1 });
  }
  return ring;
};

const square: Ring = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
  { x: 0, y: 0 },
];

describe('simplifying an outline', () => {
  it('collapses a straight run to its ends', () => {
    const straight: Ring = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ];

    expect(simplify(straight, 0.5)).toHaveLength(2);
  });

  it('turns a staircase into a line, which is the whole point', () => {
    const stairs = staircase(40);

    expect(simplify(stairs, 1.5).length).toBeLessThan(stairs.length / 5);
  });

  it('keeps a bay that is deeper than the tolerance', () => {
    const bay: Ring = [
      { x: 0, y: 0 },
      { x: 5, y: 6 },
      { x: 10, y: 0 },
    ];

    expect(simplify(bay, 1)).toHaveLength(3);
    expect(simplify(bay, 8)).toHaveLength(2);
  });

  it('keeps the first and last point, so a ring stays closed', () => {
    const simplified = simplify(square, 2);

    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified.at(-1)).toEqual({ x: 0, y: 0 });
  });

  it('leaves a ring alone when asked for no tolerance', () => {
    expect(simplify(square, 0)).toBe(square);
  });
});

describe('smoothing an outline', () => {
  it('rounds the corners off', () => {
    const rounded = smooth(square, 1);

    expect(rounded.length).toBeGreaterThan(square.length);
    expect(rounded).not.toContainEqual({ x: 0, y: 0 });
  });

  it('stays closed', () => {
    const rounded = smooth(square, 2);

    expect(rounded[0]).toEqual(rounded.at(-1));
  });

  it('stays inside the shape it started from', () => {
    const rounded = smooth(square, 3);

    for (const point of rounded) {
      expect(point.x).toBeGreaterThanOrEqual(-0.001);
      expect(point.x).toBeLessThanOrEqual(10.001);
      expect(point.y).toBeGreaterThanOrEqual(-0.001);
      expect(point.y).toBeLessThanOrEqual(10.001);
    }
  });

  it('keeps most of the area, so an island does not shrink away', () => {
    const before = Math.abs(doubleSignedArea(square)) / 2;
    const after = Math.abs(doubleSignedArea(smooth(square, 2))) / 2;

    expect(after).toBeGreaterThan(before * 0.8);
  });

  it('refuses to smooth away a shape too small to have corners', () => {
    const tiny: Ring = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ];

    expect(smooth(tiny, 4)).toBe(tiny);
  });
});

describe('the signed area', () => {
  it('is the area of the shape', () => {
    expect(Math.abs(doubleSignedArea(square)) / 2).toBeCloseTo(100, 9);
  });

  it('changes sign with the winding, which is how a hole is known', () => {
    const reversed = [...square].reverse();

    expect(Math.sign(doubleSignedArea(reversed))).toBe(-Math.sign(doubleSignedArea(square)));
  });
});

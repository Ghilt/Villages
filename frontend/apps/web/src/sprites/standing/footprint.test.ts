import { describe, expect, it } from 'vitest';
import { GROUND_LATTICE, alongU, alongV, frameOf, worldXOf, worldYOf } from '@villages/world';

import { footprintAt } from './footprint';

const FRAME = frameOf(GROUND_LATTICE);
const corner = (u: number, v: number) => ({ x: worldXOf(FRAME, u, v), y: worldYOf(FRAME, u, v) });

describe("a structure's footprint on the ground", () => {
  it('is the square of diamonds running back from the corner its foot stands on', () => {
    const corners = footprintAt(corner(10, 20), 4);

    const near = (value: number) => Math.round(value * 1e6) / 1e6;
    expect(corners.map(({ x, y }) => [near(alongU(FRAME, x, y)), near(alongV(FRAME, x, y))])).toEqual([
      [10, 20],
      [6, 20],
      [6, 16],
      [10, 16],
    ]);
  });

  it('reaches further back on its right than on its left, turned twenty-six degrees', () => {
    const [foot, left, back, right] = footprintAt(corner(10, 20), 4);

    expect(left.x).toBeLessThan(foot.x);
    expect(right.x).toBeGreaterThan(foot.x);
    expect(back.y).toBeLessThan(Math.min(left.y, right.y));
    expect(right.y).toBeLessThan(left.y);
  });

  it('is nothing but its foot for a structure the catalogue gives no footprint', () => {
    const foot = corner(3, 7);

    for (const one of footprintAt(foot, 0)) {
      expect(one.x).toBeCloseTo(foot.x);
      expect(one.y).toBeCloseTo(foot.y);
    }
  });
});

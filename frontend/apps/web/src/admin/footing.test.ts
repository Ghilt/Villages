import { describe, expect, it } from 'vitest';

import { footingOf } from './footing';

describe('a building on its footprint, as the structures page draws it', () => {
  const footing = footingOf(8, 1, 0.6, 6);

  it('has a diamond for every cell of the square, and its front corner, the lowest, on the foot', () => {
    expect(footing.diamonds).toHaveLength(36);
    const [front, ...rest] = footing.outline;
    expect(front!.x).toBeCloseTo(0, 9);
    expect(front!.y).toBeCloseTo(0, 9);
    for (const corner of rest) expect(corner.y).toBeLessThan(0);
  });

  it('runs back up the screen from the foot, wider to the left than to the right, as the lattice is turned', () => {
    const [, left, , right] = footing.outline;
    expect(-left!.x).toBeGreaterThan(right!.x);
    // A square of six is about 1.34 times six across, the camera leaving widths alone.
    expect(right!.x - left!.x).toBeCloseTo(6 * (Math.cos(0.4538) + Math.sin(0.4538)), 3);
  });

  it('stands the picture on its foot, as tall as it is', () => {
    expect(footing.picture).toEqual({ x: -4.8, y: -8, width: 8, height: 8 });
    expect(footing.box.y).toBe(-8);
  });
});

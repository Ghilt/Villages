import { describe, expect, it } from 'vitest';

import { frameOf, GROUND_LATTICE, worldXOf, worldYOf } from '@villages/world';

import { latticeAt, latticeFrom, latticeMatrix, latticeOf, onCell } from './lattice';

describe('the ground’s lattice in a diorama', () => {
  const lattice = latticeOf({ x: 100, y: 200 }, 24);

  it('is the map’s own: turned as the ground is, and squashed as the camera sees it closest in', () => {
    const frame = frameOf(GROUND_LATTICE);
    for (const [u, v] of [
      [1, 0],
      [0, 1],
      [-3, 7],
    ] as const) {
      const at = latticeAt(lattice, u, v);
      expect(at.x).toBeCloseTo(100 + worldXOf(frame, u, v) * 24);
      expect(at.y).toBeCloseTo(200 + worldYOf(frame, u, v) * 24 * Math.SQRT1_2);
    }
  });

  it('runs one way down to the right at about 19 degrees, and the other down to the left at about 55', () => {
    expect((Math.atan2(lattice.u.y, lattice.u.x) * 180) / Math.PI).toBeCloseTo(19, 0);
    expect((Math.atan2(lattice.v.y, -lattice.v.x) * 180) / Math.PI).toBeCloseTo(55.4, 0);
  });

  it('finds the corner a place is at, and the middle of the cell it is in', () => {
    const at = latticeFrom(lattice, latticeAt(lattice, 2.25, -4.5));
    expect(at.u).toBeCloseTo(2.25);
    expect(at.v).toBeCloseTo(-4.5);
    const middle = onCell(lattice, latticeAt(lattice, 2.9, -4.1));
    expect(middle.x).toBeCloseTo(latticeAt(lattice, 2.5, -4.5).x);
    expect(middle.y).toBeCloseTo(latticeAt(lattice, 2.5, -4.5).y);
  });

  it('is an SVG transform that draws a unit square as one cell', () => {
    expect(latticeMatrix(lattice)).toBe(
      `matrix(${lattice.u.x} ${lattice.u.y} ${lattice.v.x} ${lattice.v.y} 100 200)`,
    );
  });
});

import { describe, expect, it } from 'vitest';

import { SQUARE_LATTICE, alongU, alongV, frameOf, worldXOf, worldYOf } from './lattice.ts';

const TURNED = [
  { turn: 26, size: 1 },
  { turn: 26, size: 4 },
  { turn: 45, size: 3 },
  { turn: 13, size: 1 },
];

describe('the frame of a lattice', () => {
  it('is the world itself for the square lattice, exactly, so nothing on it moves by a bit', () => {
    const square = frameOf(SQUARE_LATTICE);
    for (const [x, y] of [
      [0, 0],
      [17721.6, 11089.7],
      [-3.25, 32768],
    ] as const) {
      expect(alongU(square, x, y)).toBe(x);
      expect(alongV(square, x, y)).toBe(y);
      expect(worldXOf(square, x, y)).toBe(x);
      expect(worldYOf(square, x, y)).toBe(y);
    }
  });

  it('comes back to where it started, going into the lattice and out again', () => {
    for (const lattice of TURNED) {
      const frame = frameOf(lattice);
      for (const [x, y] of [
        [0, 0],
        [17721.6, 11089.7],
        [32768, 0.5],
      ] as const) {
        const u = alongU(frame, x, y);
        const v = alongV(frame, x, y);

        expect(worldXOf(frame, u, v)).toBeCloseTo(x, 9);
        expect(worldYOf(frame, u, v)).toBeCloseTo(y, 9);
      }
    }
  });

  it('turns without mirroring or stretching: both axes a cell long, and the same way round as the world', () => {
    for (const lattice of TURNED) {
      const frame = frameOf(lattice);
      const eastX = worldXOf(frame, 1, 0);
      const eastY = worldYOf(frame, 1, 0);
      const southX = worldXOf(frame, 0, 1);
      const southY = worldYOf(frame, 0, 1);

      expect(Math.hypot(eastX, eastY)).toBeCloseTo(lattice.size, 12);
      expect(Math.hypot(southX, southY)).toBeCloseTo(lattice.size, 12);
      // Positive, as the world's own east and south are: a ring keeps the way round it goes.
      expect(eastX * southY - eastY * southX).toBeGreaterThan(0);
    }
  });
});

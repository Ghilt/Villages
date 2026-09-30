import { describe, expect, it } from 'vitest';

import { FILL_NAMES, paintFill, wrappingFbm, wrappingNoise } from './uiFills.ts';

describe('the noise the fills are painted from', () => {
  it('wraps across both edges, so the picture after the last column is the first again', () => {
    for (const y of [0, 17, 63]) {
      expect(wrappingNoise(128, y, 128, 4, 4, 5)).toBeCloseTo(wrappingNoise(0, y, 128, 4, 4, 5), 10);
      expect(wrappingNoise(y, 128, 128, 4, 4, 5)).toBeCloseTo(wrappingNoise(y, 0, 128, 4, 4, 5), 10);
    }
  });

  it('wraps in every octave', () => {
    expect(wrappingFbm(256, 40, 256, [3, 5], 4, 9)).toBeCloseTo(wrappingFbm(0, 40, 256, [3, 5], 4, 9), 10);
  });

  it('stays between nought and one', () => {
    for (let x = 0; x < 64; x += 3) {
      const value = wrappingFbm(x, x * 2, 64, [2, 2], 5, 1);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('a fill', () => {
  const SIZE = 64;

  /** How far apart two pixels of a fill are, the largest difference in any channel. */
  const apart = (data: Uint8Array, a: number, b: number) =>
    Math.max(
      Math.abs(data[a * 4]! - data[b * 4]!),
      Math.abs(data[a * 4 + 1]! - data[b * 4 + 1]!),
      Math.abs(data[a * 4 + 2]! - data[b * 4 + 2]!),
    );

  for (const name of FILL_NAMES) {
    it(`${name} meets itself at its edges no harder than it changes anywhere else`, () => {
      const data = paintFill(name, SIZE);
      const middle = SIZE / 2;
      // Across and down separately, because a grain can change much faster one way than the other.
      let seamAcross = 0;
      let seamDown = 0;
      let across = 0;
      let down = 0;
      for (let at = 0; at < SIZE; at += 1) {
        seamAcross = Math.max(seamAcross, apart(data, at * SIZE + SIZE - 1, at * SIZE));
        seamDown = Math.max(seamDown, apart(data, (SIZE - 1) * SIZE + at, at));
        across = Math.max(across, apart(data, at * SIZE + middle - 1, at * SIZE + middle));
        down = Math.max(down, apart(data, (middle - 1) * SIZE + at, middle * SIZE + at));
      }
      // A seam would be a jump of tens where the grain is a few levels a pixel.
      expect(seamAcross).toBeLessThanOrEqual(across * 2 + 4);
      expect(seamDown).toBeLessThanOrEqual(down * 2 + 4);
    });

    it(`${name} is opaque`, () => {
      const data = paintFill(name, 16);
      for (let pixel = 0; pixel < 16 * 16; pixel += 1) {
        expect(data[pixel * 4 + 3]).toBe(255);
      }
    });
  }
});

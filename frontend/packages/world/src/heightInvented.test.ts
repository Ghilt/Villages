import { describe, expect, it } from 'vitest';

import {
  RANGE_METRES,
  gradientNoise,
  inventedGround,
  inventedRelief,
  ruggednessOf,
} from './heightInvented.ts';

/** Every sample of a function over a square of the master, `step` pixels apart. */
function samples(of: (x: number, y: number) => number, side = 2048, step = 7): number[] {
  const out: number[] = [];
  for (let y = 0; y < side; y += step) for (let x = 0; x < side; x += step) out.push(of(x, y));
  return out;
}
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

describe('ground invented for invented land', () => {
  it('is noise that is the same every time and stays about between -1 and 1', () => {
    expect(gradientNoise(12.3, 45.6)).toBe(gradientNoise(12.3, 45.6));
    const all = samples((x, y) => gradientNoise(x / 9.7, y / 9.7));
    expect(Math.max(...all)).toBeLessThan(1.5);
    expect(Math.min(...all)).toBeGreaterThan(-1.5);
    expect(Math.max(...all) - Math.min(...all)).toBeGreaterThan(1);
  });

  it('rolls about its middle where gentle, and stands up out of it where a range', () => {
    const gentle = samples((x, y) => inventedRelief(x, y, 0, 1));
    const range = samples((x, y) => inventedRelief(x, y, 1, 1));
    expect(Math.abs(mean(gentle))).toBeLessThan(0.1);
    expect(mean(range)).toBeGreaterThan(0.1);
    expect(Math.min(...range)).toBeGreaterThanOrEqual(0);
  });

  it('adds no wave finer than the pixels it is cut at, so far out it is smoother (rolling ground: a ridge is a crease at every size)', () => {
    // How much it bends from one pixel to the next, which the finest waves are nearly all of.
    const bend = (finest: number) =>
      mean(
        samples((x, y) => {
          const at = (dx: number) => inventedRelief(x + dx, y, 0, finest);
          return Math.abs(at(-1) - 2 * at(0) + at(1));
        }),
      );
    expect(bend(16)).toBeLessThan(bend(1) / 10);
  });

  it('reads how rugged the master paints each cell from its classes', () => {
    const names = ['ocean', 'bare-rock', 'farmland'];
    // Eight by four pixels: bare rock on the left half, farmland on the right.
    const cells = Uint8Array.from({ length: 32 }, (_, i) => (i % 8 < 4 ? 1 : 2));
    const rugged = ruggednessOf({ width: 8, height: 4, cells }, names, 4);
    expect(Array.from(rugged)).toEqual([1, Math.fround(0.04)]);
  });

  it('swings as its painting asks inland, takes Earth’s roughness near it, and fades in from the edge', () => {
    // A row of eight cells: Earth's smooth land at the west end, then invented rock all the way east.
    const columns = 8;
    const invented = [1, 2, 3, 4, 5, 6, 7];
    const roughness = new Float32Array(columns);
    const rugged = Float32Array.from({ length: columns }, (_, i) => (i === 0 ? 0 : 1));
    const rings = Uint16Array.from({ length: columns }, (_, i) => i);
    const { swing, fade } = inventedGround(columns, 1, invented, roughness, rugged, rings);
    expect(swing[1]!).toBeLessThan(swing[6]!);
    expect(swing[6]!).toBeGreaterThan(RANGE_METRES * 0.5);
    expect(swing[6]!).toBeLessThanOrEqual(RANGE_METRES);
    expect(fade[1]!).toBeLessThan(0.1);
    expect(fade[5]!).toBe(1);
  });
});

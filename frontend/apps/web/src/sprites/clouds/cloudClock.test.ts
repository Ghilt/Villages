import { describe, expect, it } from 'vitest';

import { CLOUD_PERIOD, carried, latticeNear } from './cloudClock';

/** A moment in the game's own lifetime, so the numbers are as large as they really are. */
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);

/** How far apart two places on the period are, going round the short way. */
const round = (from: number, to: number): number => {
  const gap = (((to - from) % CLOUD_PERIOD) + CLOUD_PERIOD) % CLOUD_PERIOD;
  return Math.min(gap, CLOUD_PERIOD - gap);
};

describe("the clouds' clock", () => {
  it('gives every browser the same place for the same moment', () => {
    expect(carried(NOW, 12)).toBe(carried(NOW, 12));
  });

  it('stays on the period', () => {
    for (let ms = NOW; ms < NOW + 10_000_000; ms += 777_777) {
      const at = carried(ms, 12);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(at).toBeLessThan(CLOUD_PERIOD);
    }
  });

  it('moves on by the speed, to a thousandth of a unit, even across the wrap', () => {
    // Twelve units a second comes round every forty-five minutes; three hours crosses the wrap four times.
    for (let ms = NOW; ms < NOW + 3 * 3_600_000; ms += 1000) {
      const moved = round(carried(ms, 12), carried(ms + 1000, 12));
      expect(Math.abs(moved - 12)).toBeLessThan(0.001);
    }
  });

  it("holds a frame-sized step at today's clock, where a single-precision number would not", () => {
    const step = round(carried(NOW, 12), carried(NOW + 50, 12));
    expect(Math.abs(step - 0.6)).toBeLessThan(0.0001);
  });

  it('cuts the clouds from lattices that go round the period whole, as near the size asked as that allows', () => {
    for (const size of [40, 160, 320, 333, 900, 5120]) {
      const { cell, around } = latticeNear(size);
      expect(Number.isInteger(around)).toBe(true);
      expect(cell * around).toBeCloseTo(CLOUD_PERIOD, 6);
      expect(Math.abs(CLOUD_PERIOD / size - around)).toBeLessThanOrEqual(0.5);
    }
    // A clump's size is a few hundred units, so it is never more than a percent from the size asked.
    expect(Math.abs(latticeNear(320).cell - 320) / 320).toBeLessThan(0.01);
    expect(latticeNear(100_000)).toEqual({ cell: CLOUD_PERIOD, around: 1 });
  });
});

import { describe, expect, it } from 'vitest';

import { WATER_LOOK } from '../water/look';
import { CLOUD_PERIOD } from './clouds/cloudClock';
import { DOWN_WIND, WIND_LOOK, gustsCarried, windTime } from './wind';

describe("the world's one wind", () => {
  it('blows the way the sea does', () => {
    const towards = (WATER_LOOK.realistic.waves.wind * Math.PI) / 180;
    expect(DOWN_WIND.east).toBeCloseTo(Math.cos(towards));
    expect(DOWN_WIND.south).toBeCloseTo(Math.sin(towards));
    expect(Math.hypot(DOWN_WIND.east, DOWN_WIND.south)).toBeCloseTo(1);
  });

  it('carries the gusts the same way at the same moment in every browser, and never jumps', () => {
    const now = Date.UTC(2026, 9, 16, 12, 0, 0);
    expect(gustsCarried(now)).toBe(gustsCarried(now));
    // A second on, the gusts have gone their speed further down the wind, round the period and all.
    for (const at of [now, now + 1234567, 0, 1e13]) {
      const moved = (gustsCarried(at + 1000) - gustsCarried(at) + CLOUD_PERIOD) % CLOUD_PERIOD;
      expect(moved).toBeCloseTo(WIND_LOOK.gusts.speed, 4);
      expect(gustsCarried(at)).toBeGreaterThanOrEqual(0);
      expect(gustsCarried(at)).toBeLessThan(CLOUD_PERIOD);
    }
  });

  it("gives the wall clock's seconds modulo an hour", () => {
    expect(windTime(Date.UTC(2026, 9, 16, 12, 0, 30))).toBeCloseTo(30);
    expect(windTime(Date.UTC(2026, 9, 16, 12, 59, 59, 500))).toBeCloseTo(3599.5);
  });
});

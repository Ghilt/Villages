import { describe, expect, it } from 'vitest';

import { LIGHT, towardsTheLight } from './light';

describe('the one light', () => {
  it('comes from the upper right, so whatever it casts falls to the left and a little down', () => {
    const { east, south } = towardsTheLight();
    expect(east).toBeGreaterThan(0);
    expect(south).toBeLessThan(0);
    // Mostly from the side: seventy degrees round from north is twenty above east.
    expect(Math.abs(south / east)).toBeCloseTo(Math.tan((20 * Math.PI) / 180), 6);
    expect(Math.hypot(east, south)).toBeCloseTo(1, 9);
  });

  it('stands where the relief and the scenery were cut for', () => {
    expect(LIGHT).toEqual({ direction: 70, altitude: 40 });
  });
});

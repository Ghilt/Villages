import { describe, expect, it } from 'vitest';

import { toHalf } from './FogLayer';

describe('a distance as the half float the fog texture holds', () => {
  it('writes the numbers a distance field uses exactly', () => {
    expect(toHalf(0)).toBe(0x0000);
    expect(toHalf(1)).toBe(0x3c00);
    expect(toHalf(-1)).toBe(0xbc00);
    expect(toHalf(64)).toBe(0x5400);
    expect(toHalf(-64)).toBe(0xd400);
    expect(toHalf(0.5)).toBe(0x3800);
  });

  it('rounds what it cannot hold to the nearest, and keeps a sign', () => {
    // 1.0009765625 is one past 1 in the last place a half has; half of that rounds up to it.
    expect(toHalf(1.00048828125)).toBe(0x3c01);
    expect(toHalf(-49.29)).toBe(0xd229);
  });
});

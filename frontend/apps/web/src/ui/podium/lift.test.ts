import { describe, expect, it } from 'vitest';

import { WANDERS, over, wandered } from './lift';

describe('the podium', () => {
  it('keeps a press that stays on the die, and lets go of one that wanders off it', () => {
    expect(wandered({ x: 10, y: 10 }, { x: 10 + WANDERS, y: 10 })).toBe(false);
    expect(wandered({ x: 10, y: 10 }, { x: 10 + WANDERS * 0.8, y: 10 + WANDERS * 0.8 })).toBe(true);
  });

  it('takes a die let go over its slot back, the slot edges included', () => {
    const slot = { left: 100, top: 200, right: 164, bottom: 264 };
    expect(over(slot, { x: 100, y: 264 })).toBe(true);
    expect(over(slot, { x: 132, y: 232 })).toBe(true);
    expect(over(slot, { x: 99, y: 232 })).toBe(false);
    expect(over(slot, { x: 132, y: 265 })).toBe(false);
  });
});

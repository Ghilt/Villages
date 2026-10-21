import { describe, expect, it } from 'vitest';

import { townsfolkPlaces, townsfolkSides } from './townsfolk';

describe('the townsfolk', () => {
  it('stand with each side in the tug’s share of them', () => {
    for (const tug of [-100, -62.5, -7, 0, 12.4, 28.3, 77, 100]) {
      const sides = townsfolkSides(tug, 20);
      const withA = sides.filter((side) => side === 'a').length;
      expect(withA).toBe(Math.round(((tug + 100) / 200) * 20));
    }
  });

  it('are half each when the tug is even, and all one side’s at an end', () => {
    expect(townsfolkSides(0, 20).filter((side) => side === 'a')).toHaveLength(10);
    expect(townsfolkSides(100, 20).every((side) => side === 'a')).toBe(true);
    expect(townsfolkSides(-100, 20).every((side) => side === 'b')).toBe(true);
  });

  it('fill each side’s places from its speaker outward', () => {
    const places = { a: ['a0', 'a1', 'a2', 'a3'], b: ['b0', 'b1', 'b2', 'b3'] };
    expect(townsfolkPlaces(['a', 'a', 'a', 'b'], places)).toEqual(['a0', 'a1', 'a2', 'b0']);
    expect(townsfolkPlaces(['a', 'b', 'b', 'b'], places)).toEqual(['a0', 'b2', 'b1', 'b0']);
  });

  it('swing one at a time: whoever crosses is the last of one side and the first of the other', () => {
    const before = townsfolkSides(10, 20);
    const after = townsfolkSides(20, 20);
    const crossed = before.map((side, at) => (side === after[at] ? null : at)).filter((at) => at !== null);
    expect(crossed).toEqual([11]);
  });
});

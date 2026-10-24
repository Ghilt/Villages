import { describe, expect, it } from 'vitest';

import { numberOf } from './rolling';

describe('the number on top of a die thrown for a roll', () => {
  it('is six for a legendary roll and five for a rare one', () => {
    expect(numberOf('legendary', 0)).toBe(6);
    expect(numberOf('rare', 0.9)).toBe(5);
  });

  it('is three or four for an uncommon roll, and one or two for a common one', () => {
    expect([numberOf('uncommon', 0.1), numberOf('uncommon', 0.9)]).toEqual([3, 4]);
    expect([numberOf('common', 0.1), numberOf('common', 0.9)]).toEqual([1, 2]);
  });
});

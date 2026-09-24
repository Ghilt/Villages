import { describe, expect, it } from 'vitest';

import { dayOf } from '@villages/protocol';

import { ageOn } from './ages';

const born = dayOf(1760, 5, 9);

describe('how old a character is', () => {
  it('is the years completed since the birthday, and not one more until it comes round', () => {
    expect(ageOn(born, 0, dayOf(1790, 5, 8))).toBe(29);
    expect(ageOn(born, 0, dayOf(1790, 5, 9))).toBe(30);
  });

  it('is nought on the day they are born', () => {
    expect(ageOn(born, 0, born)).toBe(0);
  });

  it('adds the years they were aged out of the ordinary, and takes away the ones they were made younger', () => {
    expect(ageOn(born, 10, dayOf(1790, 5, 9))).toBe(40);
    expect(ageOn(born, -10, dayOf(1790, 5, 9))).toBe(20);
  });

  it('is never below nought, even when the server let a birthday land a few days after today', () => {
    expect(ageOn(born, -30, dayOf(1790, 5, 8))).toBe(0);
  });

  it('keeps a leap-day birthday until the day after the last of February in a year without one', () => {
    const leapling = dayOf(1772, 2, 29);

    expect(ageOn(leapling, 0, dayOf(1790, 2, 28))).toBe(17);
    expect(ageOn(leapling, 0, dayOf(1790, 3, 1))).toBe(18);
  });
});

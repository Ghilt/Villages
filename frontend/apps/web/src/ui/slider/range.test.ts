import { describe, expect, it } from 'vitest';

import { shareOf, stepped, travelOf } from './range';

describe('a value along its range', () => {
  it('is a share from nought to one', () => {
    expect(shareOf(25, 0, 100)).toBe(0.25);
    expect(shareOf(-5, -10, 10)).toBe(0.25);
  });

  it('stops at the ends rather than running past them', () => {
    expect(shareOf(140, 0, 100)).toBe(1);
    expect(shareOf(-3, 0, 100)).toBe(0);
  });

  it('is nought for a range with no length, rather than a division by it', () => {
    expect(shareOf(5, 10, 10)).toBe(0);
    expect(shareOf(Number.NaN, 0, 100)).toBe(0);
  });
});

describe('the knob’s travel', () => {
  it('runs from the inner edge of one end to the inner edge of the other', () => {
    // The browser's own slider is laid half a knob past each end of the travel.
    expect(travelOf([64, 21], 25)).toEqual({ left: 51.5, right: 8.5 });
  });
});

describe('a stepper', () => {
  it('goes one step either way', () => {
    expect(stepped(12, 1, 1, 20)).toBe(13);
    expect(stepped(12, -1, 1, 20)).toBe(11);
  });

  it('goes no further than either end', () => {
    expect(stepped(20, 1, 1, 20)).toBe(20);
    expect(stepped(1, -1, 1, 20)).toBe(1);
  });
});

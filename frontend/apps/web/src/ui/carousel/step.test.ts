import { describe, expect, it } from 'vitest';

import { keyStepOf, stepOf, swipeOf, SWIPE_LEAST } from './step';

describe('a carousel stepping', () => {
  it('goes round from the last to the first, and back, when it wraps', () => {
    expect(stepOf(2, 1, 3, true)).toBe(0);
    expect(stepOf(0, -1, 3, true)).toBe(2);
    expect(stepOf(1, 1, 3, true)).toBe(2);
  });

  it('stays at an end when it does not wrap', () => {
    expect(stepOf(2, 1, 3, false)).toBe(2);
    expect(stepOf(0, -1, 3, false)).toBe(0);
    expect(stepOf(0, 1, 3, false)).toBe(1);
  });

  it('has nowhere to go with one thing or none', () => {
    expect(stepOf(0, 1, 1, true)).toBe(0);
    expect(stepOf(0, -1, 1, false)).toBe(0);
    expect(stepOf(0, 1, 0, true)).toBe(0);
  });

  it('is stepped by the arrows, and sent to the ends by Home and End', () => {
    expect(keyStepOf('ArrowRight', 0, 4, false)).toBe(1);
    expect(keyStepOf('ArrowLeft', 0, 4, true)).toBe(3);
    expect(keyStepOf('Home', 2, 4, false)).toBe(0);
    expect(keyStepOf('End', 0, 4, false)).toBe(3);
    expect(keyStepOf('Enter', 0, 4, false)).toBeNull();
  });
});

describe('a swipe', () => {
  it('goes along for a drag to the left and back for one to the right', () => {
    expect(swipeOf(-100, 0, 300)).toBe(1);
    expect(swipeOf(100, 0, 300)).toBe(-1);
  });

  it('is nothing when it is too short: a fifth of the way across, and never less than the least', () => {
    expect(swipeOf(-59, 0, 300)).toBe(0);
    expect(swipeOf(-61, 0, 300)).toBe(1);
    expect(swipeOf(-(SWIPE_LEAST - 1), 0, 100)).toBe(0);
  });

  it('is nothing when it went more down than across, as a page being scrolled does', () => {
    expect(swipeOf(-100, 80, 300)).toBe(0);
    expect(swipeOf(-100, 60, 300)).toBe(1);
  });
});

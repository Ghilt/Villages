import { describe, expect, it } from 'vitest';

import { stepAlong, stopOf } from './bar';

describe('the stop a bar has for Tab', () => {
  it('is the chosen button', () => {
    expect(stopOf([true, true, true], 2)).toBe(2);
  });

  it('is the first that can be pressed when none is chosen', () => {
    expect(stopOf([false, true, true], -1)).toBe(1);
  });

  it('passes over a chosen button that cannot be pressed', () => {
    expect(stopOf([true, false, true], 1)).toBe(0);
  });

  it('is nowhere when nothing can be pressed', () => {
    expect(stopOf([false, false], 0)).toBeNull();
  });
});

describe('the arrow keys along a bar', () => {
  const all = [true, true, true, true];

  it('step along with either pair, whichever way the bar runs', () => {
    expect(stepAlong(1, 'ArrowRight', all)).toBe(2);
    expect(stepAlong(1, 'ArrowDown', all)).toBe(2);
    expect(stepAlong(1, 'ArrowLeft', all)).toBe(0);
    expect(stepAlong(1, 'ArrowUp', all)).toBe(0);
  });

  it('come round at the ends', () => {
    expect(stepAlong(3, 'ArrowDown', all)).toBe(0);
    expect(stepAlong(0, 'ArrowUp', all)).toBe(3);
  });

  it('pass over a button that cannot be pressed', () => {
    expect(stepAlong(0, 'ArrowRight', [true, false, true])).toBe(2);
  });

  it('go to the ends with Home and End', () => {
    expect(stepAlong(2, 'Home', all)).toBe(0);
    expect(stepAlong(0, 'End', all)).toBe(3);
  });

  it('leave every other key alone', () => {
    expect(stepAlong(0, 'Enter', all)).toBeNull();
    expect(stepAlong(0, 'a', all)).toBeNull();
  });
});

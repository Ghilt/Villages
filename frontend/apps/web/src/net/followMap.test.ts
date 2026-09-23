import { describe, expect, it } from 'vitest';

import { followZoom } from './followMap';

/**
 * The zoom the cells are asked for at. Cell ids carry their zoom, so changing it replaces every cell
 * at once; the point of the stickiness is that a camera resting on a boundary does not do that twice.
 */
describe('which zoom the view is followed at', () => {
  it('rounds, the first time, because there is nothing to stick to', () => {
    expect(followZoom(8.4, null)).toBe(8);
    expect(followZoom(8.6, null)).toBe(9);
    expect(followZoom(0.2, null)).toBe(0);
  });

  it('never asks past the deepest cells there are', () => {
    expect(followZoom(10.4, null)).toBe(10);
    expect(followZoom(12, null)).toBe(10);
    expect(followZoom(10, 10)).toBe(10);
  });

  it('stays where it is while the camera wobbles across the midpoint', () => {
    // Rounding alone would make every one of these a different set of cells.
    expect(followZoom(8.49, 8)).toBe(8);
    expect(followZoom(8.51, 8)).toBe(8);
    expect(followZoom(8.6, 8)).toBe(8);
    expect(followZoom(8.64, 8)).toBe(8);
  });

  it('takes the step once the camera has really made one', () => {
    expect(followZoom(8.65, 8)).toBe(9);
    expect(followZoom(9.2, 8)).toBe(9);
    expect(followZoom(7.3, 8)).toBe(7);
  });

  it('sticks in both directions, so coming back is as hard as going', () => {
    // Having stepped up to 9 at 8.65, drifting back to 8.4 does not step down again.
    expect(followZoom(8.4, 9)).toBe(9);
    expect(followZoom(8.36, 9)).toBe(9);
    expect(followZoom(8.34, 9)).toBe(8);
  });

  it('follows a flight wherever it lands, because that is a step and not a wobble', () => {
    expect(followZoom(4, 9)).toBe(4);
    expect(followZoom(10, 4)).toBe(10);
  });
});

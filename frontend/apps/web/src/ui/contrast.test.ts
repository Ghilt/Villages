import { describe, expect, it } from 'vitest';

import {
  colourOf,
  contrastNeeded,
  contrastOf,
  luminanceOf,
  over,
  READABLE,
  READABLE_LARGE,
} from './contrast';
import type { Rgba } from './contrast';

const BLACK: Rgba = [0, 0, 0, 1];
const WHITE: Rgba = [255, 255, 255, 1];

describe('contrast', () => {
  it('is twenty-one for black on white, either way round, and one for a colour on itself', () => {
    expect(contrastOf(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrastOf(WHITE, BLACK)).toBeCloseTo(21, 5);
    expect(contrastOf([92, 72, 50, 1], [92, 72, 50, 1])).toBe(1);
  });

  it('puts the grey that just passes on white just over 4.5', () => {
    // #767676 is the lightest grey that is readable on white, and #777777 is the darkest that is not.
    expect(contrastOf(colourOf('#767676')!, WHITE)).toBeGreaterThan(READABLE);
    expect(contrastOf(colourOf('#777777')!, WHITE)).toBeLessThan(READABLE);
  });

  it('weighs green brightest and blue darkest, as the eye does', () => {
    expect(luminanceOf([0, 255, 0, 1])).toBeGreaterThan(luminanceOf([255, 0, 0, 1]));
    expect(luminanceOf([255, 0, 0, 1])).toBeGreaterThan(luminanceOf([0, 0, 255, 1]));
  });

  it('reads every way a colour is written, and nothing else', () => {
    expect(colourOf('#2b1d10')).toEqual([43, 29, 16, 1]);
    expect(colourOf('#abc')).toEqual([170, 187, 204, 1]);
    expect(colourOf('rgb(43, 29, 16)')).toEqual([43, 29, 16, 1]);
    expect(colourOf('rgba(43, 29, 16, 0.5)')).toEqual([43, 29, 16, 0.5]);
    expect(colourOf('rgb(43 29 16 / 50%)')).toEqual([43, 29, 16, 0.5]);
    expect(colourOf('color(srgb 1 0.5 0 / 0.25)')).toEqual([255, 127.5, 0, 0.25]);
    expect(colourOf('rgb(100% 50% 0%)')).toEqual([255, 127.5, 0, 1]);
    expect(colourOf('gold')).toBeNull();
    expect(colourOf('rgb(1, 2)')).toBeNull();
  });

  it('lays a translucent colour over another as the browser does', () => {
    expect(over([0, 0, 0, 0.5], WHITE)).toEqual([127.5, 127.5, 127.5, 1]);
    expect(over([10, 20, 30, 1], WHITE)).toEqual([10, 20, 30, 1]);
    expect(over([0, 0, 0, 0], [0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });

  it('asks less of large words: 24 pixels, or 18.66 and bold', () => {
    expect(contrastNeeded(16, 400)).toBe(READABLE);
    expect(contrastNeeded(24, 400)).toBe(READABLE_LARGE);
    expect(contrastNeeded(19, 700)).toBe(READABLE_LARGE);
    expect(contrastNeeded(19, 600)).toBe(READABLE);
  });
});

import { describe, expect, it } from 'vitest';

import { fitOf, standing } from './dioramaFit';

describe('a scene fitted to its box', () => {
  it('covers a wider box, cropping top and bottom evenly', () => {
    expect(fitOf({ width: 1000, height: 600 }, { width: 2000, height: 1000 }, 'cover')).toEqual({
      scale: 2,
      left: 0,
      top: -100,
    });
  });

  it('stands whole inside a box when it is to be contained', () => {
    expect(fitOf({ width: 1000, height: 600 }, { width: 2000, height: 1000 }, 'contain')).toEqual({
      scale: 1000 / 600,
      left: (2000 - 1000 * (1000 / 600)) / 2,
      top: 0,
    });
  });

  it('draws at its own size in a box not measured yet', () => {
    expect(fitOf({ width: 1000, height: 600 }, { width: 0, height: 0 }, 'cover')).toEqual({
      scale: 1,
      left: 0,
      top: 0,
    });
  });
});

describe('a picture standing on its foot', () => {
  it('is laid round its foot, at its own shape', () => {
    const frame = { x: 10, y: 20, width: 100, height: 200 };
    expect(standing(frame, { x: 0.5, y: 1 }, { x: 300, y: 400 }, 100)).toEqual({
      left: 275,
      top: 300,
      width: 50,
      height: 100,
    });
  });

  it('keeps a building’s foot at the front corner of its base, right of its middle', () => {
    const frame = { x: 0, y: 0, width: 160, height: 160 };
    const placed = standing(frame, { x: 0.67, y: 1 }, { x: 500, y: 300 }, 200);
    expect(placed.left + 0.67 * placed.width).toBeCloseTo(500);
    expect(placed.top + placed.height).toBe(300);
  });
});

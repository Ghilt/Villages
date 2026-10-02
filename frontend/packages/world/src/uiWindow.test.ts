import { describe, expect, it } from 'vitest';

import type { Rgba } from './art.ts';
import { LEAST_WINDOW, punchedOf, windowOf } from './uiWindow.ts';

/** A picture of this size, each pixel opaque or clear as `opaque` says. */
function pictureOf(width: number, height: number, opaque: (x: number, y: number) => boolean): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set([200, 160, 90, opaque(x, y) ? 255 : 0], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const within = (x: number, y: number, cx: number, cy: number, r: number) =>
  (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

describe('a medallion’s window', () => {
  it('is the clear middle a ring shuts in, as shares of the picture', () => {
    // A ring of 40 across, clear in the middle within 12 of it, on clear room.
    const ring = pictureOf(50, 50, (x, y) => within(x, y, 25, 25, 20) && !within(x, y, 25, 25, 12));
    const window = windowOf(ring)!;
    expect(window.left * 50).toBeCloseTo(13, 0);
    expect(window.top * 50).toBeCloseTo(13, 0);
    expect(window.width * 50).toBeCloseTo(25, 0);
    expect(window.height * 50).toBeCloseTo(25, 0);
  });

  it('is nowhere in a picture painted whole, or one clear only round its edge', () => {
    expect(windowOf(pictureOf(30, 30, () => true))).toBeNull();
    expect(windowOf(pictureOf(30, 30, (x, y) => within(x, y, 15, 15, 12)))).toBeNull();
  });

  it('is the largest of several clear places, and none at all too small to hold anything', () => {
    // Two holes in a solid square: one 10 square, one 4 square.
    const two = pictureOf(
      40,
      40,
      (x, y) => !((x >= 5 && x < 15 && y >= 5 && y < 15) || (x >= 25 && x < 29 && y >= 25 && y < 29)),
    );
    expect(windowOf(two)!.width * 40).toBe(10);
    // A hole of one pixel in a hundred is under the least a window takes.
    const pinhole = pictureOf(10, 10, (x, y) => !(x === 5 && y === 5));
    expect(1 / 100).toBeLessThan(LEAST_WINDOW);
    expect(windowOf(pinhole)).toBeNull();
  });

  it('is punched as an ellipse, clear in its middle and the frame round it kept', () => {
    const whole = pictureOf(60, 80, () => true);
    const punched = punchedOf(whole, { cx: 30, cy: 40, rx: 15, ry: 25 });
    const alphaAt = (x: number, y: number) => punched.data[(y * 60 + x) * 4 + 3];
    expect(alphaAt(30, 40)).toBe(0);
    expect(alphaAt(2, 2)).toBe(255);
    expect(alphaAt(30, 10)).toBe(255);
    const window = windowOf(punched)!;
    expect(window.width * 60).toBeCloseTo(30, 0);
    expect(window.height * 80).toBeCloseTo(50, 0);
  });
});

import { describe, expect, it } from 'vitest';

import type { RgbImage } from './png.ts';
import { drawSilhouette, PORTRAIT_HEIGHT, PORTRAIT_WIDTH } from './portrait.ts';

/** Small, so the tests are quick: the drawing is in the unit square and comes out the same at any size. */
const small = (sitter: 'woman' | 'man', seed: number): RgbImage => drawSilhouette(sitter, seed, 96, 128);

/** How much of the card is ink: the share of pixels darker than the card could ever be. */
function inkShare(image: RgbImage): number {
  let dark = 0;
  for (let at = 0; at < image.pixels.length; at += 3) {
    if (image.pixels[at]! < 120) {
      dark += 1;
    }
  }
  return dark / (image.width * image.height);
}

describe('a placeholder portrait', () => {
  it('is three wide by four tall, and large enough for a big bay at twice its density', () => {
    expect(PORTRAIT_WIDTH * 4).toBe(PORTRAIT_HEIGHT * 3);
    expect(PORTRAIT_WIDTH).toBeGreaterThanOrEqual(768);
  });

  it('is drawn at the size it is asked for', () => {
    const image = drawSilhouette('man', 1, 30, 40);

    expect(image.width).toBe(30);
    expect(image.height).toBe(40);
    expect(image.pixels.length).toBe(30 * 40 * 3);
  });

  it('is the same picture every time for the same sitter', () => {
    expect(small('woman', 3).pixels).toEqual(small('woman', 3).pixels);
  });

  it('differs from one sitter to the next, and between a woman and a man', () => {
    expect(small('woman', 1).pixels).not.toEqual(small('woman', 2).pixels);
    expect(small('woman', 1).pixels).not.toEqual(small('man', 1).pixels);
  });

  it('is a silhouette on a card: plenty of ink, and more card than ink', () => {
    for (const sitter of ['woman', 'man'] as const) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const share = inkShare(small(sitter, seed));
        expect(share, `${sitter} ${seed}`).toBeGreaterThan(0.2);
        expect(share, `${sitter} ${seed}`).toBeLessThan(0.6);
      }
    }
  });
});

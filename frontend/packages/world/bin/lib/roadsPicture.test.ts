import { describe, expect, it } from 'vitest';

import type { Chain } from '../../src/roads/network.ts';
import { encodeRgbaPng, roadsPicture, stroke } from './roadsPicture.ts';

const alphaAt = (pixels: Uint8Array, side: number, x: number, y: number) => pixels[(y * side + x) * 4 + 3]!;
const colourAt = (pixels: Uint8Array, side: number, x: number, y: number) =>
  Array.from(pixels.subarray((y * side + x) * 4, (y * side + x) * 4 + 3));

describe('the picture of every road', () => {
  it('is nothing where there is no road, and whole along one', () => {
    const pixels = new Uint8Array(16 * 16 * 4);
    stroke(pixels, 16, { x: 2, y: 8.5 }, { x: 14, y: 8.5 }, 1, [200, 30, 30]);
    expect(alphaAt(pixels, 16, 8, 8)).toBe(255);
    expect(colourAt(pixels, 16, 8, 8)).toEqual([200, 30, 30]);
    expect(alphaAt(pixels, 16, 8, 2)).toBe(0);
    // Soft at its edge.
    expect(alphaAt(pixels, 16, 8, 9)).toBeGreaterThan(0);
    expect(alphaAt(pixels, 16, 8, 9)).toBeLessThan(255);
    expect(alphaAt(pixels, 16, 8, 10)).toBe(0);
  });

  it('wraps round the world from one side to the other', () => {
    const pixels = new Uint8Array(16 * 16 * 4);
    stroke(pixels, 16, { x: 14, y: 4.5 }, { x: 18, y: 4.5 }, 0.6, [0, 0, 0]);
    expect(alphaAt(pixels, 16, 1, 4)).toBe(255);
    expect(alphaAt(pixels, 16, 15, 4)).toBe(255);
  });

  it('draws a trunk over the track it crosses, a bridge over its road, and a settlement as a dot', () => {
    const width = 64;
    const chain = (grade: Chain['grade'], points: { x: number; y: number }[], bridge = false): Chain => ({
      points,
      grade,
      bridge: bridge ? { axis: 'u', span: 2 } : null,
    });
    const pixels = roadsPicture(
      [
        chain('trunk', [
          { x: 32, y: 8 },
          { x: 32, y: 56 },
        ]),
        chain('track', [
          { x: 8, y: 32 },
          { x: 56, y: 32 },
        ]),
        chain('road', [
          { x: 8, y: 48 },
          { x: 56, y: 48 },
        ]),
        chain(
          'road',
          [
            { x: 44, y: 48 },
            { x: 52, y: 48 },
          ],
          true,
        ),
      ],
      [{ x: 16.5, y: 16.5 }],
      [],
      width,
      64,
    );
    expect(colourAt(pixels, 64, 32, 32)).toEqual([196, 32, 36]);
    expect(colourAt(pixels, 64, 48, 48)).toEqual([24, 24, 28]);
    expect(colourAt(pixels, 64, 20, 48)).toEqual([214, 110, 30]);
    expect(alphaAt(pixels, 64, 16, 16)).toBe(255);
    expect(alphaAt(pixels, 64, 4, 4)).toBe(0);
  });
});

describe("the roads picture's file", () => {
  it('is a PNG of four bytes a pixel, which reads back as it was drawn', async () => {
    const pixels = new Uint8Array(8 * 8 * 4);
    stroke(pixels, 8, { x: 1, y: 4.5 }, { x: 7, y: 4.5 }, 1, [200, 30, 30]);
    const png = encodeRgbaPng(8, pixels);
    const { default: sharp } = await import('sharp');
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([8, 8, 4]);
    expect(Array.from(data)).toEqual(Array.from(pixels));
  });
});

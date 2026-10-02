import { describe, expect, it } from 'vitest';

import type { RgbImage } from './png.ts';
import { drawScene, SCENE_HEIGHT, SCENE_WIDTH } from './scene.ts';

/** Small, so the tests are quick: the drawing is in the unit square and comes out the same at any size. */
const small = (): RgbImage => drawScene('harbour', 96, 64);

function pixelAt(image: RgbImage, x: number, y: number): readonly [number, number, number] {
  const at = (Math.floor(y * image.height) * image.width + Math.floor(x * image.width)) * 3;
  return [image.pixels[at]!, image.pixels[at + 1]!, image.pixels[at + 2]!];
}

describe('a placeholder scene', () => {
  it('is three wide by two tall, the shape an image model hands back, and wide enough for a column opened out', () => {
    expect(SCENE_WIDTH * 2).toBe(SCENE_HEIGHT * 3);
    expect(SCENE_WIDTH).toBeGreaterThanOrEqual(1536);
  });

  it('is drawn at the size it is asked for', () => {
    const image = drawScene('harbour', 30, 20);

    expect(image.width).toBe(30);
    expect(image.height).toBe(20);
    expect(image.pixels.length).toBe(30 * 20 * 3);
  });

  it('is the same picture every time', () => {
    expect(small().pixels).toEqual(small().pixels);
  });

  // Warm paper above, grey-green water below: the two things a band across its middle has to keep.
  it('has the sky above the horizon and the sea below it', () => {
    const [skyRed, , skyBlue] = pixelAt(small(), 0.5, 0.1);
    const [seaRed, seaGreen] = pixelAt(small(), 0.9, 0.8);

    expect(skyRed).toBeGreaterThan(skyBlue + 20);
    expect(seaGreen).toBeGreaterThan(seaRed);
  });
});

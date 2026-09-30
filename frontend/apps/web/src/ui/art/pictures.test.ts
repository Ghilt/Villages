import { describe, expect, it } from 'vitest';

import type { UiArtFile, UiPicture } from '@villages/world';

import { imageSetOf, pictureIn, sourcesOf } from './pictures';

const border: UiPicture = {
  kind: 'borders',
  name: 'gilt-simple',
  source: 'borders/gilt-simple.webp',
  placeholder: true,
  width: 96,
  height: 96,
  painted: { width: 384, height: 384 },
  how: 'its own alpha',
  cuts: [1, 2, 3].map((density) => ({
    density,
    url: `/ui/borders/gilt-simple.abc@${density}x.webp`,
    width: 96 * density,
    height: 96 * density,
    bytes: 1000 * density,
  })),
};

const list: UiArtFile = { version: 'v', cutAt: '2026-09-30T12:00:00Z', paintedAt: 4, pictures: [border] };

describe('a picture the page draws', () => {
  it('is found by its kind and its name', () => {
    expect(pictureIn(list, 'borders', 'gilt-simple')).toBe(border);
    expect(pictureIn(list, 'fills', 'gilt-simple')).toBeUndefined();
    expect(pictureIn(null, 'borders', 'gilt-simple')).toBeUndefined();
  });

  it('offers CSS every density it was cut at, to pick from', () => {
    expect(imageSetOf(border)).toBe(
      'image-set(url("/ui/borders/gilt-simple.abc@1x.webp") 1x, url("/ui/borders/gilt-simple.abc@2x.webp") 2x, ' +
        'url("/ui/borders/gilt-simple.abc@3x.webp") 3x)',
    );
  });

  it('offers an image the same, falling back on the plain one', () => {
    expect(sourcesOf(border)).toEqual({
      src: '/ui/borders/gilt-simple.abc@1x.webp',
      srcSet:
        '/ui/borders/gilt-simple.abc@1x.webp 1x, /ui/borders/gilt-simple.abc@2x.webp 2x, ' +
        '/ui/borders/gilt-simple.abc@3x.webp 3x',
    });
  });
});

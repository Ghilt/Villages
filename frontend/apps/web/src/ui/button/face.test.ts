import { describe, expect, it } from 'vitest';

import type { UiArtFile, UiBorder, UiPicture } from '@villages/world';

import { faceOf } from './face';

const cuts: UiBorder = {
  slice: [32, 42, 33, 42],
  repeat: ['stretch', 'stretch'],
  content: [32, 42, 33, 42],
  outset: [0, 0, 0, 0],
  middle: false,
  fillUnder: [16, 21, 17, 21],
};

const face = (name: string, width: number, height: number, border?: UiBorder): UiPicture => ({
  kind: 'controls',
  name,
  source: `controls/${name}.webp`,
  placeholder: true,
  width,
  height,
  painted: { width: width * 4, height: height * 4 },
  how: 'its own alpha',
  cuts: [{ density: 1, url: `/ui/controls/${name}.x@1x.webp`, width, height, bytes: 100 }],
  ...(border === undefined ? {} : { border }),
});

const listOf = (...pictures: UiPicture[]): UiArtFile => ({ version: 'v', cutAt: '', paintedAt: 4, pictures });

describe('a button’s face', () => {
  it('is stretched along its cuts when it has them, scaled to the height the button is drawn', () => {
    const drawn = faceOf(listOf(face('primary', 138, 65, cuts)), 'primary', 32.5)!;
    expect(drawn.sliced).toBe(true);
    expect(drawn.style.borderWidth).toBe('16px 21px 16.5px 21px');
    expect(drawn.width).toBeUndefined();
  });

  it('keeps room at each end for its caps, so the words sit between them', () => {
    expect(faceOf(listOf(face('primary', 138, 65, cuts)), 'primary', 65)!.ends).toEqual([42, 42]);
    expect(faceOf(listOf(face('primary', 138, 65, cuts)), 'primary', 32.5)!.ends).toEqual([21, 21]);
  });

  it('draws its own middle, because a face is a thing and not a frame round one', () => {
    expect(faceOf(listOf(face('primary', 138, 65, cuts)), 'primary', 44)!.style.borderImageSlice).toMatch(
      / fill$/,
    );
  });

  it('is laid whole when it has no cuts, as wide as it is in proportion', () => {
    const drawn = faceOf(listOf(face('close', 65, 68)), 'close', 44)!;
    expect(drawn.sliced).toBe(false);
    expect(drawn.width).toBe(42);
    expect(drawn.style.backgroundImage).toMatch(/^image-set\(/);
  });

  it('is drawn in a state Adam has painted rather than in light and shade', () => {
    const list = listOf(face('primary', 138, 65, cuts), face('primary-hover', 138, 65));
    const drawn = faceOf(list, 'primary', 44)!;
    expect(drawn.painted).toEqual(['hover']);
    expect(drawn.style['--ui-face-hover']).toMatch(/primary-hover/);
    expect(drawn.style['--ui-face-pressed']).toBeUndefined();
  });

  it('is not there when there is no picture by its name', () => {
    expect(faceOf(listOf(), 'primary', 44)).toBeUndefined();
    expect(faceOf(null, 'primary', 44)).toBeUndefined();
  });
});

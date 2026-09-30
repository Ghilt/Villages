import { describe, expect, it } from 'vitest';

import type { UiBorder, UiPicture } from '@villages/world';

import { borderImageOf, contentInsetOf, fillImageOf, fillInsetOf } from './borderStyle';

const border: UiBorder = {
  slice: [24, 23, 25, 22],
  repeat: ['round', 'stretch'],
  inset: [4, 4, 4, 4],
  outset: [2, 0, 0, 0],
  middle: false,
  fillUnder: [12, 11, 12, 11],
};

const picture = (width: number, height: number, kind: UiPicture['kind'] = 'borders'): UiPicture => ({
  kind,
  name: 'gilt',
  source: `${kind}/gilt.webp`,
  placeholder: true,
  width,
  height,
  painted: { width: width * 4, height: height * 4 },
  how: 'its own alpha',
  cuts: [1, 2].map((density) => ({
    density,
    url: `/ui/${kind}/gilt.x@${density}x.webp`,
    width: width * density,
    height: height * density,
    bytes: 100,
  })),
});

describe('a border as CSS draws it', () => {
  it('cuts the picture by shares of it, the top and bottom of its height and the sides of its width', () => {
    const style = borderImageOf(picture(100, 80), border);
    expect(style.borderImageSlice).toBe('30% 23% 31.25% 22%');
  });

  it('lays the border as wide as its cuts, as shown', () => {
    const style = borderImageOf(picture(100, 80), border);
    expect(style.borderWidth).toBe('24px 23px 25px 22px');
    expect(style.borderImageWidth).toBe('24px 23px 25px 22px');
    expect(style.borderImageOutset).toBe('2px 0px 0px 0px');
  });

  it('lays the edges as its file says, unless it is told otherwise', () => {
    expect(borderImageOf(picture(100, 80), border).borderImageRepeat).toBe('round stretch');
    expect(borderImageOf(picture(100, 80), border, { repeat: ['space', 'space'] }).borderImageRepeat).toBe(
      'space space',
    );
  });

  it('draws its own middle only when its file asks and nothing is laid under it', () => {
    expect(borderImageOf(picture(100, 80), border).borderImageSlice).not.toMatch(/fill/);
    const middled = { ...border, middle: true };
    expect(borderImageOf(picture(100, 80), middled).borderImageSlice).toMatch(/ fill$/);
    expect(borderImageOf(picture(100, 80), middled, { middle: false }).borderImageSlice).not.toMatch(/fill/);
  });

  it('offers every density it was cut at', () => {
    expect(borderImageOf(picture(100, 80), border).borderImageSource).toBe(
      'image-set(url("/ui/borders/gilt.x@1x.webp") 1x, url("/ui/borders/gilt.x@2x.webp") 2x)',
    );
  });

  it('cuts so that a share lands on a whole pixel at every density', () => {
    // 23 of 107 is not a round share, and it still has to be 23, 46 and 69 pixels at 1x, 2x and 3x.
    const odd = picture(107, 111);
    const [, right] = borderImageOf(odd, border).borderImageSlice.split(' ');
    const fraction = Number(right!.replace('%', '')) / 100;
    for (const density of [1, 2, 3]) {
      expect(fraction * 107 * density).toBeCloseTo(23 * density, 3);
    }
  });
});

describe('a fill', () => {
  it('repeats at the size it is shown', () => {
    expect(fillImageOf(picture(128, 128, 'fills'))).toEqual({
      backgroundImage: 'image-set(url("/ui/fills/gilt.x@1x.webp") 1x, url("/ui/fills/gilt.x@2x.webp") 2x)',
      backgroundSize: '128px 128px',
      backgroundRepeat: 'repeat',
    });
  });

  it('stands in from each edge by the cut, less what reaches under the border', () => {
    expect(fillInsetOf(border)).toEqual([12, 12, 13, 11]);
    expect(fillInsetOf(undefined)).toEqual([0, 0, 0, 0]);
  });

  it('never stands outside the box, however far it is said to reach', () => {
    expect(fillInsetOf({ ...border, fillUnder: [40, 40, 40, 40] })).toEqual([0, 0, 0, 0]);
  });
});

describe('the content in a bordered box', () => {
  it('starts past the cut and then the inset', () => {
    expect(contentInsetOf(border)).toEqual([28, 27, 29, 26]);
    expect(contentInsetOf(undefined)).toEqual([0, 0, 0, 0]);
  });
});

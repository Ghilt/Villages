import { describe, expect, it } from 'vitest';

import type { UiBorder, UiPicture } from '@villages/world';

import { ruleStyleOf } from './rule';

const border: UiBorder = {
  slice: [0, 14, 0, 14],
  repeat: ['stretch', 'stretch'],
  inset: [0, 0, 0, 0],
  outset: [0, 0, 0, 0],
  middle: true,
  fillUnder: [0, 7, 0, 7],
};

const picture: UiPicture = {
  kind: 'dividers',
  name: 'gilt',
  source: 'dividers/gilt.webp',
  placeholder: true,
  width: 160,
  height: 9,
  painted: { width: 640, height: 36 },
  how: 'its own alpha',
  cuts: [{ density: 1, url: '/ui/dividers/gilt.1@1x.webp', width: 160, height: 9, bytes: 600 }],
  border,
};

describe('a divider’s rule', () => {
  it('is as tall as its picture, with both its ends, and the line between them stretched', () => {
    const style = ruleStyleOf(picture, border);
    expect(style.height).toBe(9);
    expect(style.borderImageWidth).toBe('0px 14px 0px 14px');
    expect(style.borderImageSlice).toBe('0% 8.75% 0% 8.75% fill');
  });

  it('leaves off the end beside a knot, so the line runs up to it', () => {
    expect(ruleStyleOf(picture, border, 'left').borderImageWidth).toBe('0px 0px 0px 14px');
    expect(ruleStyleOf(picture, border, 'right').borderImageWidth).toBe('0px 14px 0px 0px');
    expect(ruleStyleOf(picture, border, 'right').borderWidth).toBe('0px 14px 0px 0px');
  });
});

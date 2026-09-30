import { describe, expect, it } from 'vitest';

import type { UiBorder } from '@villages/world';

import { layoutOf, placeOf } from './layout';
import type { Recipe } from './layout';

const gilt: UiBorder = {
  slice: [24, 24, 24, 24],
  repeat: ['stretch', 'stretch'],
  inset: [4, 4, 4, 4],
  outset: [0, 0, 0, 0],
  middle: false,
  fillUnder: [12, 12, 12, 12],
};

const sizes: Record<string, { width: number; height: number }> = {
  'cherub-standing': { width: 60, height: 123 },
  'cross-gilt': { width: 49, height: 62 },
};
const sizeOf = (art: string) => sizes[art];

describe('a container laid out', () => {
  it('sets its content in by the border’s cut and inset, and the recipe’s padding', () => {
    const layout = layoutOf({ border: 'gilt-simple', padding: 8 }, gilt, sizeOf);
    expect(layout.padding).toEqual([36, 36, 36, 36]);
  });

  it('sets its content in further by a keep-out, on the side it is said for and no other', () => {
    const recipe: Recipe = {
      border: 'gilt-simple',
      embellishments: [{ art: 'cherub-standing', anchor: 'top-right', keepOut: { right: 40 } }],
    };
    const layout = layoutOf(recipe, gilt, sizeOf);
    expect(layout.padding).toEqual([28, 68, 28, 28]);
    expect(layout.keepOut).toEqual([0, 40, 0, 0]);
  });

  it('takes the widest keep-out on a side, where two embellishments ask for room on it', () => {
    const recipe: Recipe = {
      embellishments: [
        { art: 'cherub-standing', anchor: 'top-right', keepOut: { top: 20 } },
        { art: 'cross-gilt', anchor: 'top', keepOut: { top: 30 } },
      ],
    };
    expect(layoutOf(recipe, undefined, sizeOf).keepOut).toEqual([30, 0, 0, 0]);
  });

  it('keeps a margin as wide as its overhangs, so nothing beside it runs under them', () => {
    const recipe: Recipe = {
      embellishments: [
        { art: 'cherub-standing', anchor: 'bottom-right', overhang: { x: 24, y: 10 } },
        { art: 'cross-gilt', anchor: 'top', overhang: { y: 40 } },
      ],
    };
    expect(layoutOf(recipe, undefined, sizeOf).margin).toEqual([40, 24, 10, 0]);
    expect(layoutOf({ ...recipe, roomForOverhangs: false }, undefined, sizeOf).margin).toEqual([0, 0, 0, 0]);
  });

  it('stands its fill in by the border’s cut, less what reaches under it', () => {
    expect(layoutOf({ border: 'gilt-simple' }, gilt, sizeOf).fillInset).toEqual([12, 12, 12, 12]);
  });

  it('draws an embellishment at the size its picture is shown, or as tall as it is told, in proportion', () => {
    const shown = layoutOf(
      { embellishments: [{ art: 'cherub-standing', anchor: 'top-left' }] },
      undefined,
      sizeOf,
    );
    expect([shown.placed[0]!.width, shown.placed[0]!.height]).toEqual([60, 123]);
    const told = layoutOf(
      { embellishments: [{ art: 'cherub-standing', anchor: 'top-left', height: 82 }] },
      undefined,
      sizeOf,
    );
    expect([told.placed[0]!.width, told.placed[0]!.height]).toEqual([40, 82]);
  });

  it('leaves out an embellishment whose picture is not there, which then takes no room', () => {
    const layout = layoutOf({ embellishments: [{ art: 'nobody', anchor: 'top' }] }, undefined, sizeOf);
    expect(layout.placed).toEqual([]);
  });
});

describe('an embellishment placed', () => {
  it('sits on its corner, pushed out by its overhang', () => {
    const placed = placeOf({ art: 'cherub', anchor: 'top-right', overhang: { x: 24, y: 18 } }, 60, 120);
    expect(placed.place).toEqual({ right: '-24px', top: '-18px' });
  });

  it('sits in the middle of its edge when it is pinned to one', () => {
    expect(placeOf({ art: 'cross', anchor: 'top', overhang: { y: 40 } }, 50, 60).place).toEqual({
      left: '50%',
      top: '-40px',
      transform: 'translateX(-50%)',
    });
    expect(placeOf({ art: 'cross', anchor: 'left' }, 50, 60).place).toEqual({
      left: '0px',
      top: '50%',
      transform: 'translateY(-50%)',
    });
  });

  it('is turned left to right when it is mirrored', () => {
    expect(placeOf({ art: 'cherub', anchor: 'bottom-left', mirrored: true }, 60, 120).place).toEqual({
      left: '0px',
      bottom: '0px',
      transform: 'scaleX(-1)',
    });
  });
});

describe('the sentence Adam says, as a recipe', () => {
  it('a gilt border and a cherub in the top right corner that takes forty pixels from the content', () => {
    const recipe: Recipe = {
      border: 'gilt-simple',
      fill: 'parchment',
      embellishments: [
        { art: 'cherub-standing', anchor: 'top-right', overhang: { x: 20, y: 30 }, keepOut: { right: 40 } },
      ],
    };
    const layout = layoutOf(recipe, gilt, sizeOf);
    expect(layout.padding[1]).toBe(24 + 4 + 40);
    expect(layout.margin).toEqual([30, 20, 0, 0]);
    expect(layout.placed[0]!.place).toEqual({ right: '-20px', top: '-30px' });
  });
});

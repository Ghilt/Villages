import { describe, expect, it } from 'vitest';

import type { UiBorder } from '@villages/world';

import { bleedOf, layoutOf, placeOf } from './layout';
import type { Recipe } from './layout';

const gilt: UiBorder = {
  slice: [24, 24, 24, 24],
  repeat: ['stretch', 'stretch'],
  content: [28, 28, 28, 28],
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

  it('starts its content inside the cuts when the border says so, clear of a deep corner', () => {
    const deep: UiBorder = { ...gilt, slice: [100, 100, 100, 100], content: [16, 60, 22, 60] };
    expect(layoutOf({ border: 'gilt-acanthus', padding: 4 }, deep, sizeOf).padding).toEqual([20, 64, 26, 64]);
  });

  it('says how far past the content its fill reaches, for a picture behind the words to run out to', () => {
    const deep: UiBorder = {
      ...gilt,
      slice: [100, 100, 100, 100],
      content: [16, 60, 22, 60],
      fillUnder: [90, 90, 90, 90],
    };
    const layout = layoutOf({ border: 'gilt-cherubs', padding: 2 }, deep, sizeOf);
    // The fill stands 10 in from each edge, the words 18, 62, 24 and 62.
    expect(bleedOf(layout)).toEqual([8, 52, 14, 52]);
    expect(
      bleedOf(layoutOf({ border: 'gilt-simple', padding: 8 }, { ...gilt, fillUnder: [0, 0, 0, 0] }, sizeOf)),
    ).toEqual([12, 12, 12, 12]);
  });

  it('gives an embellishment none of the content’s room, wherever it is pinned', () => {
    const recipe: Recipe = {
      border: 'gilt-simple',
      padding: 8,
      embellishments: [
        { art: 'cherub-standing', anchor: 'top-right', overhang: { x: 30, y: 30 } },
        { art: 'cross-gilt', anchor: 'top', overhang: { y: 46 } },
      ],
    };
    expect(layoutOf(recipe, gilt, sizeOf).padding).toEqual([36, 36, 36, 36]);
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

  it('draws its border at a scale, and sets its content and fill in by as much less', () => {
    const layout = layoutOf({ border: 'gilt-thin', scale: 0.5, padding: 2 }, gilt, sizeOf);
    expect(layout.padding).toEqual([16, 16, 16, 16]);
    expect(layout.fillInset).toEqual([6, 6, 6, 6]);
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

  it('draws nothing for an embellishment whose picture is not there, and keeps its margin all the same', () => {
    const layout = layoutOf(
      { embellishments: [{ art: 'nobody', anchor: 'top', overhang: { y: 40 } }] },
      undefined,
      sizeOf,
    );
    expect(layout.placed).toEqual([]);
    // So the container does not move when the picture arrives.
    expect(layout.margin).toEqual([40, 0, 0, 0]);
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
  it('a gilt border, and a cherub standing on the top right corner, out past the frame', () => {
    const recipe: Recipe = {
      border: 'gilt-simple',
      fill: 'parchment',
      padding: 8,
      embellishments: [{ art: 'cherub-standing', anchor: 'top-right', overhang: { x: 30, y: 30 } }],
    };
    const layout = layoutOf(recipe, gilt, sizeOf);
    expect(layout.placed[0]!.place).toEqual({ right: '-30px', top: '-30px' });
    expect(layout.margin).toEqual([30, 30, 0, 0]);
    // The words keep the whole width: the cherub stands on the corner, not in them.
    expect(layout.padding).toEqual([36, 36, 36, 36]);
  });
});

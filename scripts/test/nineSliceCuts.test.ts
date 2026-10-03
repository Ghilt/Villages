import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Rgba } from '../lib/border.ts';
import { cutsFromEdges, linesIn, tilesAt } from '../lib/nineSlice/cuts.ts';
import {
  borderFileFor,
  clearBackground,
  isClearRound,
  opaque,
  scaledFile,
  standsOnChecks,
} from '../lib/nineSlice/frame.ts';
import { readNineSliceRecipe, recipeText } from '../lib/nineSlice/recipe.ts';

type Rgba4 = readonly [number, number, number, number];

function picture(width: number, height: number, at: (x: number, y: number) => Rgba4): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(at(x, y), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const alphaAt = (image: Rgba, x: number, y: number) => image.data[(y * image.width + x) * 4 + 3];

/** A little noise, the same every time, so that a picture is not perfectly flat where a painting is not. */
const noise = (x: number, y: number) => ((x * 7919 + y * 104729) % 13) - 6;

const FELT = (x: number, y: number): Rgba4 => [40 + noise(x, y), 34 + noise(x, y), 26, 255];
const CLOUD = (x: number, y: number): Rgba4 => [150 + noise(x, y), 155, 165 + noise(y, x), 255];

describe('finding the lines between tiles that are not plain white or black gaps', () => {
  // Felt and clouds, with a thin off-white line a quarter of the way in each way and a groove, a dark
  // line beside a light one, three quarters of the way in.
  const lined = picture(120, 120, (x, y) => {
    if (x === 30 || y === 28) return [235, 225, 210, 255];
    if (x === 89 || y === 91) return [15, 13, 11, 255];
    if (x === 90 || y === 92) return [150, 140, 120, 255];
    return x < 20 || y < 20 ? CLOUD(x, y) : FELT(x, y);
  });

  it('finds a thin line and a groove, wherever they are, with a pixel either side for their soft edge', () => {
    const found = linesIn(lined);
    assert.ok(found !== null);
    assert.deepEqual(found.columns, [
      [29, 31],
      [88, 91],
    ]);
    assert.deepEqual(found.rows, [
      [27, 29],
      [90, 93],
    ]);
  });

  it('does not take the edge of something light beside something dark for a line', () => {
    const stepped = picture(120, 120, (x, y) => (x < 40 ? CLOUD(x, y) : FELT(x, y)));
    assert.equal(linesIn(stepped), null);
  });
});

describe('cutting a frame painted whole, with no lines between its tiles', () => {
  // Corners of gilt and stone in a check pattern, 30 square, and between them edges that are the same
  // all the way along: a moulding of three bands, over felt.
  const ornate = (x: number, y: number) => ((x >> 2) + (y >> 2)) % 2 === 0;
  const whole = picture(150, 150, (x, y) => {
    const inCorner = (x < 30 || x >= 120) && (y < 30 || y >= 120);
    if (inCorner) return ornate(x, y) ? [200, 150, 70, 255] : [60, 50, 40, 255];
    const inward = Math.min(x, y, 149 - x, 149 - y);
    if (inward < 6) return [200, 150, 70, 255];
    if (inward < 12) return [120, 90, 50, 255];
    if (inward < 18) return [220, 200, 160, 255];
    return FELT(x, y);
  });

  it('cuts where each edge stops being the same along its length', () => {
    const cuts = cutsFromEdges(whole);
    assert.ok(cuts !== null);
    for (const cut of cuts) {
      assert.ok(cut >= 30 && cut <= 34, `a cut of ${cut} keeps the corner and little more`);
    }
  });

  it('gives up on a picture whose edges cannot be told from its corners', () => {
    assert.equal(cutsFromEdges(picture(150, 150, (x, y) => FELT(x, y))), null);
  });

  it('turns four cuts into nine tiles, and refuses cuts that do not fit', () => {
    assert.deepEqual(tilesAt([10, 20, 30, 40], 100, 100), {
      columns: [
        [0, 39],
        [40, 79],
        [80, 99],
      ],
      rows: [
        [0, 9],
        [10, 69],
        [70, 99],
      ],
    });
    assert.throws(() => tilesAt([60, 10, 50, 10], 100, 100), /do not fit/);
  });
});

describe('what a frame stands on', () => {
  const CHECKS = (x: number, y: number): Rgba4 =>
    ((x >> 3) + (y >> 3)) % 2 === 0 ? [254, 254, 254, 255] : [220, 220, 220, 255];
  // A ring of marble on painted checks, round felt.
  const onChecks = picture(80, 80, (x, y) => {
    const inward = Math.min(x, y, 79 - x, 79 - y);
    if (inward < 10) return CHECKS(x, y);
    if (inward < 20) return [205, 190, 165, 255];
    return FELT(x, y);
  });

  it('tells painted checks round a frame, and transparency round one, from a frame that runs to the edge', () => {
    assert.equal(standsOnChecks(onChecks), true);
    assert.equal(standsOnChecks(picture(80, 80, (x, y) => FELT(x, y))), false);
    assert.equal(isClearRound(picture(80, 80, (x) => (x < 5 ? [0, 0, 0, 0] : [9, 9, 9, 255]))), true);
    assert.equal(isClearRound(picture(80, 80, () => [9, 9, 9, 140])), false);
  });

  it('clears the checks and keeps the frame, and its middle when asked to', () => {
    const cleared = clearBackground(onChecks, 'checker', false);
    assert.equal(alphaAt(cleared, 2, 2), 0);
    assert.equal(alphaAt(cleared, 15, 40), 255);
    assert.equal(alphaAt(cleared, 40, 40), 255);
  });

  it('keeps everything of a frame that stands on nothing', () => {
    assert.equal(clearBackground(onChecks, 'none'), onChecks);
  });

  it('makes a picture opaque that was only half transparent by a slip in saving it', () => {
    assert.equal(alphaAt(opaque(picture(4, 4, () => [9, 9, 9, 140])), 1, 1), 255);
  });

  it('writes a border that keeps its own middle without a fill under it', () => {
    assert.deepEqual(borderFileFor([10, 10, 10, 10], [5, 5, 5, 5], 'round', [18, 18, 18, 18], true), {
      slice: [10, 10, 10, 10],
      repeat: 'round',
      content: [18, 18, 18, 18],
      middle: true,
    });
  });
});

describe('a recipe the tool writes', () => {
  it('reads back as what was written, with the new backgrounds and a kept middle', () => {
    const recipe = {
      picture: '../frames/cloud.png',
      background: 'none' as const,
      columns: [
        [0, 418],
        [425, 826],
        [833, 1253],
      ] as const,
      rows: [
        [0, 413],
        [421, 822],
        [829, 1253],
      ] as const,
      repeat: 'round' as const,
      middle: true,
    };
    const text = recipeText(recipe);
    assert.match(text, /"columns": \[\[0, 418\], \[425, 826\], \[833, 1253\]\]/);
    assert.deepEqual(readNineSliceRecipe(text, 'cloud.recipe.json'), recipe);
    assert.equal(
      readNineSliceRecipe('{ "picture": "a.png", "background": "checker" }', 'a').background,
      'checker',
    );
  });

  it('refuses a middle that is both kept and made a fill', () => {
    assert.throws(
      () =>
        readNineSliceRecipe(
          '{ "picture": "a.png", "background": "none", "middle": true, "fill": "felt" }',
          'a',
        ),
      /not both/,
    );
  });
});

describe('a border made smaller', () => {
  it('scales its cuts and where its words start with it, never a cut under a pixel', () => {
    assert.deepEqual(
      scaledFile(
        { slice: [414, 421, 2, 419], repeat: 'round', content: [422, 429, 433, 427], middle: true },
        448 / 1242,
      ),
      { slice: [149, 152, 1, 151], repeat: 'round', content: [152, 155, 156, 154], middle: true },
    );
  });

  it('remembers how wide it was made in its recipe, and refuses a width too small to be a border', () => {
    const text = '{ "picture": "a.png", "background": "none", "width": 448 }';
    assert.equal(readNineSliceRecipe(text, 'a').width, 448);
    assert.match(recipeText(readNineSliceRecipe(text, 'a')), /"width": 448/);
    assert.throws(
      () => readNineSliceRecipe('{ "picture": "a.png", "background": "none", "width": 8 }', 'a'),
      /16 or more/,
    );
  });
});

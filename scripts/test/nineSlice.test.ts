import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Rgba } from '../lib/border.ts';
import {
  borderFileFor,
  clearBackground,
  contentOf,
  innerDepths,
  mirroredSquare,
} from '../lib/nineSlice/frame.ts';
import { readNineSliceRecipe } from '../lib/nineSlice/recipe.ts';
import { gapsIn, joined, tilesBetween } from '../lib/nineSlice/tiles.ts';

type Rgba4 = readonly [number, number, number, number];

/** A picture `width` by `height`, each pixel from `at`. */
function picture(width: number, height: number, at: (x: number, y: number) => Rgba4): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(at(x, y), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const pixel = (image: Rgba, x: number, y: number): number[] => [
  ...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4),
];

const WHITE: Rgba4 = [253, 253, 253, 252];
const CLEAR: Rgba4 = [0, 0, 0, 0];
const GILT: Rgba4 = [190, 140, 80, 255];
const STONE: Rgba4 = [48, 40, 30, 255];
const GROOVE: Rgba4 = [20, 18, 16, 255];
const BLACK: Rgba4 = [0, 0, 0, 255];

describe('the lines an image model leaves between its tiles', () => {
  // Nine tiles of eight, clear but for a gilt pixel each, with white lines two wide between them.
  const sheet = picture(28, 28, (x, y) => {
    const line = (at: number) => at === 8 || at === 9 || at === 18 || at === 19;
    if (line(x) || line(y)) {
      return WHITE;
    }
    return x % 10 === 4 && y % 10 === 4 ? GILT : CLEAR;
  });

  it('are found, white, across and down', () => {
    assert.deepEqual(gapsIn(sheet), {
      columns: [
        [8, 9],
        [18, 19],
      ],
      rows: [
        [8, 9],
        [18, 19],
      ],
      shade: 'light',
    });
  });

  it('take with them the pale edge they leave on the tile beside them', () => {
    const fringed = picture(28, 28, (x, y) => {
      const line = (at: number) => at === 8 || at === 9 || at === 18 || at === 19;
      if (line(x) || line(y)) {
        return WHITE;
      }
      return x === 7 ? [200, 196, 192, 120] : CLEAR;
    });
    assert.deepEqual(gapsIn(fringed).columns, [
      [7, 9],
      [18, 19],
    ]);
  });

  it('are found black too, and a black margin round the whole picture is not one', () => {
    const dark = picture(30, 30, (x, y) => {
      if (x < 2 || y < 2 || x > 27 || y > 27) {
        return BLACK;
      }
      return x === 10 || x === 20 || y === 10 || y === 20 ? BLACK : STONE;
    });
    const found = gapsIn(dark);
    assert.deepEqual(found.columns, [
      [10, 10],
      [20, 20],
    ]);
    assert.equal(found.shade, 'dark');
  });

  it('leave three tiles, which join edge to edge', () => {
    const columns = tilesBetween(gapsIn(sheet).columns, 28);
    assert.deepEqual(columns, [
      [0, 7],
      [10, 17],
      [20, 27],
    ]);
    const whole = joined(sheet, columns, columns, false);
    assert.deepEqual([whole.width, whole.height], [24, 24]);
    // The middle tile's gilt pixel, from (14, 14), now at (12, 12): nothing white is left.
    assert.deepEqual(pixel(whole, 12, 12), [...GILT]);
    assert.deepEqual(pixel(whole, 8, 8), [...CLEAR]);
    assert.equal(
      [...whole.data].some((value, at) => at % 4 === 0 && value === 253),
      false,
    );
  });

  it('can leave the middle tile out, for a fill to take its place', () => {
    const columns = tilesBetween(gapsIn(sheet).columns, 28);
    assert.deepEqual(pixel(joined(sheet, columns, columns, true), 12, 12), [...CLEAR]);
  });

  it('refuse to be guessed at when there are not two of them', () => {
    assert.throws(() => tilesBetween([[3, 4]], 20), /two/);
  });
});

describe('what a frame stands on, cleared', () => {
  // A gilt ring two wide round stone, on black, with a dark groove inside the ring itself.
  const framed = picture(20, 20, (x, y) => {
    const edge = Math.min(x, y, 19 - x, 19 - y);
    if (edge < 2) {
      return BLACK;
    }
    if (edge < 5) {
      return edge === 3 && x > 6 && x < 13 ? GROOVE : GILT;
    }
    // A fleck of the stone as warm as gilt, standing on its own.
    return x === 9 && y === 9 ? GILT : STONE;
  });
  const cleared = clearBackground(framed, { warmth: 30 });

  it('is clear outside the frame and inside it', () => {
    assert.equal(pixel(cleared, 0, 0)[3], 0);
    assert.equal(pixel(cleared, 10, 10)[3], 0);
  });

  it('takes away a fleck of what it stood on as warm as the frame, which is no part of it', () => {
    assert.equal(pixel(cleared, 9, 9)[3], 0);
  });

  it('leaves the frame whole, its own dark groove too', () => {
    assert.equal(pixel(cleared, 3, 10)[3], 255);
    assert.deepEqual(pixel(cleared, 9, 3), [...GROOVE]);
  });

  it('leaves a picture that is clear round its frame as it is', () => {
    assert.equal(clearBackground(framed, 'alpha'), framed);
  });

  it('says how deep the frame is on each side, for a fill to begin under it', () => {
    const depths = innerDepths(cleared, [6, 6, 6, 6]);
    assert.deepEqual(depths, [5, 5, 5, 5]);
    assert.deepEqual(borderFileFor([6, 6, 6, 6], depths, 'round', [5, 5, 5, 5]), {
      slice: [6, 6, 6, 6],
      repeat: 'round',
      content: [5, 5, 5, 5],
      fillUnder: [5, 5, 5, 5],
    });
  });
});

describe('where a frame’s words start', () => {
  // A frame three wide on a clear ground, cut twelve in from every edge; a ring standing two further out
  // of its left edge, and an ornament in its top left corner, wide and short.
  const frame = picture(40, 40, (x, y) => {
    const edge = Math.min(x, y, 39 - x, 39 - y);
    if (edge < 3) {
      return GILT;
    }
    if (x < 5 && y >= 19 && y <= 21) {
      return GILT;
    }
    if (x < 10 && y < 7) {
      return GILT;
    }
    return CLEAR;
  });

  it('is past the deepest of each edge, its ring and not only its shaft', () => {
    assert.equal(contentOf(frame, [12, 12, 12, 12], 0)[3], 5);
  });

  it('is clear of a corner’s ornament, by whichever side costs the words less room', () => {
    // Clearing the ornament across would take the left side to ten; down, the top only to seven.
    assert.deepEqual(contentOf(frame, [12, 12, 12, 12], 0), [7, 3, 3, 5]);
  });

  it('is inside the cuts for a frame with deep corners and thin edges, and then a margin', () => {
    assert.deepEqual(contentOf(frame, [12, 12, 12, 12], 2), [9, 5, 5, 7]);
  });
});

describe('a fill made of the middle tile', () => {
  it('is mirrored into a square twice its size, so that every edge meets itself', () => {
    const tile = picture(5, 4, (x, y) => [x * 40, y * 50, 7, 255]);
    const fill = mirroredSquare(tile, [0, 4], [0, 3]);
    assert.deepEqual([fill.width, fill.height], [8, 8]);
    for (let at = 0; at < 8; at += 1) {
      assert.deepEqual(pixel(fill, 0, at), pixel(fill, 7, at));
      assert.deepEqual(pixel(fill, at, 0), pixel(fill, at, 7));
    }
  });
});

describe('a recipe for one', () => {
  it('says what the picture is and how its frame is told from what it stands on', () => {
    assert.deepEqual(
      readNineSliceRecipe('{ "picture": "frame.webp", "background": { "warmth": 30 } }', 'frame.json'),
      { picture: 'frame.webp', background: { warmth: 30 }, repeat: 'round' },
    );
  });

  it('can say where the words start, rather than leave it to be worked out', () => {
    assert.deepEqual(
      readNineSliceRecipe(
        '{ "picture": "f.webp", "background": "alpha", "content": [60, 160, 60, 160] }',
        'f.json',
      ).content,
      [60, 160, 60, 160],
    );
    assert.throws(
      () =>
        readNineSliceRecipe('{ "picture": "f.webp", "background": "alpha", "content": [60, 160] }', 'f.json'),
      /one length or four/,
    );
  });

  it('refuses what it would have to guess at, saying what to write', () => {
    assert.throws(() => readNineSliceRecipe('{ "picture": "a.webp" }', 'a.json'), /background/);
    assert.throws(
      () => readNineSliceRecipe('{ "picture": "a.webp", "background": "alpha", "rows": [[0, 4]] }', 'a.json'),
      /three spans/,
    );
    assert.throws(
      () => readNineSliceRecipe('{ "picture": "a.webp", "background": "alpha", "tiles": 9 }', 'a.json'),
      /not something a recipe says/,
    );
  });
});

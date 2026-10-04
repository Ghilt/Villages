import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { colourOf, contrastOf, READABLE, READABLE_LARGE } from '../contrast';
import type { Rgba } from '../contrast';
import css from '../ui.css?raw';
import type { Recipe } from './layout';
import { RECIPE_NAMES, RECIPES } from './recipes';

/**
 * Every recipe's words can be read on what is behind them - its fill, or its border's own middle - measured
 * from the picture in `world/ui/` itself, and so can a field's on its face. So a fill painted too light for cream words, or a recipe that says
 * ink on a dark fill, is a failing check rather than a pane nobody can read. Both of a recipe's inks are
 * held to it, the softer as much as the other, because the softer is every label's. The page's contrast
 * switch measures everything on the page the same way, in the browser. See docs/UI-COMPONENTS.md.
 */

const UI = fileURLToPath(new URL('../../../../../../world/ui/', import.meta.url));

type Sides = readonly [number, number, number, number];

/** A colour token as `ui.css` declares it. */
function token(name: string): Rgba {
  const declared = new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1];
  const colour = declared === undefined ? null : colourOf(declared);
  if (colour === null) {
    throw new Error(`ui.css declares no colour --${name}`);
  }
  return colour;
}

/** The picture of that name in one of the folder's kinds, whatever it was saved as. */
function fileOf(kind: string, name: string): string {
  const file = readdirSync(`${UI}${kind}`).find(
    (one) => /\.(webp|png|jpe?g)$/i.test(one) && one.replace(/\.[^.]+$/, '') === name,
  );
  if (file === undefined) {
    throw new Error(`world/ui/${kind}/ has no picture called ${name}`);
  }
  return `${UI}${kind}/${file}`;
}

/** A picture's average colour, weighed by how opaque each pixel is, with `cut` off its edges if given. */
async function averageOf(file: string, cut: Sides = [0, 0, 0, 0]): Promise<Rgba> {
  const { width = 0, height = 0 } = await sharp(file).metadata();
  const [top, right, bottom, left] = cut;
  const { data } = await sharp(file)
    .extract({
      left,
      top,
      width: Math.max(1, width - left - right),
      height: Math.max(1, height - top - bottom),
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let [red, green, blue, opaque] = [0, 0, 0, 0];
  for (let at = 0; at < data.length; at += 4) {
    const alpha = data[at + 3]! / 255;
    red += data[at]! * alpha;
    green += data[at + 1]! * alpha;
    blue += data[at + 2]! * alpha;
    opaque += alpha;
  }
  return [red / opaque, green / opaque, blue / opaque, 1];
}

/** What a recipe's words stand on, and what to call it; null when nothing is drawn behind them at all. */
async function behindOf(recipe: Recipe): Promise<{ what: string; colour: Rgba } | null> {
  if (recipe.fill !== undefined) {
    return { what: `the ${recipe.fill} fill`, colour: await averageOf(fileOf('fills', recipe.fill)) };
  }
  if (recipe.border !== undefined) {
    const cuts = JSON.parse(readFileSync(`${UI}borders/${recipe.border}.json`, 'utf8')) as {
      slice: Sides;
      middle?: boolean;
    };
    if (cuts.middle === true) {
      const colour = await averageOf(fileOf('borders', recipe.border), cuts.slice);
      return { what: `the middle of ${recipe.border}`, colour };
    }
  }
  return null;
}

describe('the recipes', () => {
  it(
    'have words, and softer words, that can be read on what is behind them',
    { timeout: 30_000 },
    async () => {
      const unreadable: string[] = [];
      for (const name of RECIPE_NAMES) {
        const recipe: Recipe = RECIPES[name];
        const behind = await behindOf(recipe);
        if (behind === null) {
          unreadable.push(
            `${name}: neither a fill nor a border whose middle is drawn, so nothing is behind its words`,
          );
          continue;
        }
        const inks = recipe.text === 'ink' ? ['ui-ink', 'ui-ink-soft'] : ['ui-cream', 'ui-cream-soft'];
        // One with no softer ink says everything in its main one, so only that one has to be read.
        for (const ink of recipe.soft === false ? inks.slice(0, 1) : inks) {
          const contrast = contrastOf(token(ink), behind.colour);
          if (contrast < READABLE) {
            unreadable.push(`${name}: --${ink} on ${behind.what} is ${contrast.toFixed(2)} to 1`);
          }
        }
      }
      expect(unreadable).toEqual([]);
    },
  );
});

describe('the marks', () => {
  // A mark is drawn in its words' colour, or picked out in gilt - the tab that is up, the size chosen - and
  // a mark is a large thing to read, so gilt on every dark fill is held to the large bar.
  it('can be picked out in gilt on every dark pane', { timeout: 30_000 }, async () => {
    const unseen: string[] = [];
    for (const name of RECIPE_NAMES) {
      const recipe: Recipe = RECIPES[name];
      const behind = recipe.text === 'ink' ? null : await behindOf(recipe);
      if (behind === null) {
        continue;
      }
      const contrast = contrastOf(token('ui-gilt-light'), behind.colour);
      if (contrast < READABLE_LARGE) {
        unseen.push(`${name}: --ui-gilt-light on ${behind.what} is ${contrast.toFixed(2)} to 1`);
      }
    }
    expect(unseen).toEqual([]);
  });
});

describe('a field', () => {
  // A field's words and what it says while empty are drawn by the browser, which the page's contrast switch
  // cannot see, so they are held to it here: ink, and the softer ink, on the middle of its face.
  it('has its words, and what it says while empty, readable on its parchment', async () => {
    const cuts = JSON.parse(readFileSync(`${UI}controls/field.json`, 'utf8')) as { slice: Sides };
    const [, right, , left] = cuts.slice;
    // A face is cut across only, so its middle is between its two ends, the whole of its height.
    const middle = await averageOf(fileOf('controls', 'field'), [0, right, 0, left]);
    const unreadable = ['ui-ink', 'ui-ink-soft']
      .map((ink) => [ink, contrastOf(token(ink), middle)] as const)
      .filter(([, contrast]) => contrast < READABLE)
      .map(([ink, contrast]) => `--${ink} on the field's parchment is ${contrast.toFixed(2)} to 1`);
    expect(unreadable).toEqual([]);
  });
});

describe('the inks', () => {
  it('can be read on the grounds they are for', () => {
    const pairs = [
      ['ui-ink', 'ui-parchment'],
      ['ui-ink-soft', 'ui-parchment'],
      ['ui-cream', 'ui-night'],
      ['ui-cream-soft', 'ui-night'],
      ['ui-cream', 'ui-night-raised'],
      ['ui-cream-soft', 'ui-night-raised'],
    ] as const;
    const unreadable = pairs
      .map(([ink, ground]) => [ink, ground, contrastOf(token(ink), token(ground))] as const)
      .filter(([, , contrast]) => contrast < READABLE)
      .map(([ink, ground, contrast]) => `--${ink} on --${ground} is ${contrast.toFixed(2)} to 1`);
    expect(unreadable).toEqual([]);
  });
});

/**
 * Makes nine-slice borders out of pictures that were not painted as one, from `world/ui/sources/`: each
 * `<name>.json` there is a recipe for the picture it names, and becomes `world/ui/borders/<name>.webp` and
 * its file of cuts - and, when the recipe names a fill, its middle tile becomes that fill, in
 * `world/ui/fills/`. The source is Adam's, kept as he gave it, so the border can always be made again.
 *
 *   npm run world:nine-slice --prefix frontend                       every recipe
 *   npm run world:nine-slice --prefix frontend -- gilt-acanthus      one
 *   npm run world:nine-slice --prefix frontend -- --look frame.webp  what a picture is, before a recipe
 *
 * The nine-slice skill, `.claude/skills/nine-slice/`, is how a job is done; `AUTHORING-THE-ART.md` says
 * where the pictures go. The rules are `src/nineSlice.ts`'s.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

import sharp from 'sharp';

import type { Rgba } from '../src/art.ts';
import {
  borderFileFor,
  clearBackground,
  contentOf,
  gapsIn,
  innerDepths,
  joined,
  mirroredSquare,
  readNineSliceRecipe,
  runsOf,
  spanLength,
  tilesBetween,
} from '../src/nineSlice.ts';
import type { BorderFile, Sides } from '../src/uiArt.ts';
import { UI_DIR, UI_SOURCES_DIR } from './paths.ts';

/** How far past the frame and its ornaments the words start, when the recipe does not say: two shown. */
const CONTENT_MARGIN = 8;

/** How the border and its fill are written: what the cut tool then cuts at 1x, 2x and 3x. */
const BORDER_WEBP = { quality: 92, alphaQuality: 100, effort: 6 } as const;
const FILL_WEBP = { quality: 90 } as const;

async function decode(file: string): Promise<Rgba> {
  const { data, info } = await sharp(readFileSync(file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

/** A border's file laid out as the placeholders' are, each list of four on one line. */
function fileText(file: BorderFile): string {
  return `${JSON.stringify(file, null, 2).replace(/\[\s+([^\]]*?)\s+\]/g, (_, inside: string) => `[${inside.replace(/\s+/g, ' ')}]`)}\n`;
}

async function make(name: string): Promise<void> {
  const where = `world/ui/sources/${name}.json`;
  const recipe = readNineSliceRecipe(readFileSync(resolve(UI_SOURCES_DIR, `${name}.json`), 'utf8'), where);
  const source = resolve(UI_SOURCES_DIR, recipe.picture);
  if (!existsSync(source)) {
    throw new Error(`${where} is made from ${recipe.picture}, which is not in world/ui/sources/`);
  }
  const image = await decode(source);
  const found = recipe.columns !== undefined && recipe.rows !== undefined ? null : gapsIn(image);
  const columns = recipe.columns ?? tilesBetween(found!.columns, image.width);
  const rows = recipe.rows ?? tilesBetween(found!.rows, image.height);
  const frame = clearBackground(joined(image, columns, rows, true), recipe.background);
  const slice: Sides = [
    spanLength(rows[0]),
    spanLength(columns[2]),
    spanLength(rows[2]),
    spanLength(columns[0]),
  ];
  const depths = innerDepths(frame, slice);
  const content = recipe.content ?? contentOf(frame, slice, CONTENT_MARGIN);
  const file = borderFileFor(slice, depths, recipe.repeat, content);
  await sharp(Buffer.from(frame.data), { raw: { width: frame.width, height: frame.height, channels: 4 } })
    .webp(BORDER_WEBP)
    .toFile(resolve(UI_DIR, 'borders', `${name}.webp`));
  writeFileSync(resolve(UI_DIR, 'borders', `${name}.json`), fileText(file));
  const tiles = (spans: readonly (readonly [number, number])[]) => spans.map(spanLength).join(' + ');
  console.log(
    `${name}: ${image.width}x${image.height}, tiles ${tiles(columns)} across and ${tiles(rows)} down` +
      `${found === null ? ', as the recipe says' : `, found between ${found.shade} lines`}`,
  );
  console.log(
    `  borders/${name}.webp ${frame.width}x${frame.height}, cut at ${slice.join(' ')}, the frame ` +
      `${depths.join(' ')} deep, a fill under it from ${file.fillUnder!.map((under, side) => slice[side]! - under).join(' ')} in`,
  );
  console.log(
    `  its words start ${content.join(' ')} in${recipe.content === undefined ? ', clear of the frame and its corners' : ', as the recipe says'}`,
  );
  if (recipe.fill !== undefined) {
    const fill = mirroredSquare(image, columns[1], rows[1]);
    await sharp(Buffer.from(fill.data), { raw: { width: fill.width, height: fill.height, channels: 4 } })
      .removeAlpha()
      .webp(FILL_WEBP)
      .toFile(resolve(UI_DIR, 'fills', `${recipe.fill}.webp`));
    console.log(`  fills/${recipe.fill}.webp ${fill.width}x${fill.height}, the middle tile mirrored`);
  }
}

const quantiles = (values: number[]) => {
  values.sort((a, b) => a - b);
  const at = (share: number) => values[Math.floor(share * (values.length - 1))];
  return `${at(0.05)}..${at(0.5)}..${at(0.95)}`;
};

/** What a picture is: its size, whether it is clear round its frame, the lines it has, what it stands on. */
async function look(file: string): Promise<void> {
  const image = await decode(file);
  const { width, height, data } = image;
  let clear = 0;
  for (let at = 3; at < data.length; at += 4) clear += data[at]! < 128 ? 1 : 0;
  console.log(
    `${basename(file)}: ${width}x${height}, ${Math.round((100 * clear) / (width * height))}% of it clear`,
  );
  const found = gapsIn(image);
  console.log(
    found.shade === null
      ? '  no lines between tiles found from end to end: if they are hidden in places, measure them'
      : `  ${found.shade} lines between tiles: columns ${JSON.stringify(found.columns)}, rows ${JSON.stringify(found.rows)}`,
  );
  // Lines that are a gap's colour for a fifth of their length or more: a gap hidden in places is narrow.
  for (const axis of ['columns', 'rows'] as const) {
    const lines = axis === 'columns' ? width : height;
    const dark = (line: number) => {
      let count = 0;
      const length = axis === 'columns' ? height : width;
      for (let along = 0; along < length; along += 1) {
        const at = axis === 'columns' ? (along * width + line) * 4 : (line * width + along) * 4;
        count += (data[at]! + data[at + 1]! + data[at + 2]!) / 3 <= 12 && data[at + 3]! > 200 ? 1 : 0;
      }
      return count / length >= 0.2;
    };
    const runs = runsOf(lines, dark).filter(([from, to]) => from > 0 && to < lines - 1);
    console.log(`  dark ${axis} for a fifth of their length or more: ${JSON.stringify(runs)}`);
  }
  const warmth = (x0: number, y0: number, x1: number, y1: number) => {
    const warm: number[] = [];
    const light: number[] = [];
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const at = (y * width + x) * 4;
        if (data[at + 3]! < 128) continue;
        warm.push(data[at]! - data[at + 2]!);
        light.push(Math.round((data[at]! + data[at + 1]! + data[at + 2]!) / 3));
      }
    }
    return warm.length === 0 ? 'all clear' : `warmth ${quantiles(warm)}, brightness ${quantiles(light)}`;
  };
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.01));
  console.log(`  its outer edge, ${band} wide: ${warmth(0, 0, width, band)}`);
  console.log(
    `  its middle fifth: ${warmth(Math.round(width * 0.4), Math.round(height * 0.4), Math.round(width * 0.6), Math.round(height * 0.6))}`,
  );
}

const args = process.argv.slice(2);
if (args[0] === '--look') {
  if (args[1] === undefined) {
    throw new Error(
      '--look takes a picture: npm run world:nine-slice --prefix frontend -- --look frame.webp',
    );
  }
  await look(resolve(existsSync(args[1]) ? args[1] : resolve(UI_SOURCES_DIR, args[1])));
} else {
  const names =
    args.length > 0
      ? args
      : existsSync(UI_SOURCES_DIR)
        ? readdirSync(UI_SOURCES_DIR)
            .filter((file) => extname(file) === '.json')
            .map((file) => file.slice(0, -'.json'.length))
        : [];
  if (names.length === 0) {
    console.log(
      'no recipes in world/ui/sources/: a recipe is <name>.json beside the picture it makes a border of',
    );
  }
  for (const name of names) {
    await make(name);
  }
}

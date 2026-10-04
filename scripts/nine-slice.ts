import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

import { REPEATS } from './lib/border.ts';
import type { BorderFile, Repeat, Rgba, Sides } from './lib/border.ts';
import { cutsFromEdges, linesIn, tilesAt } from './lib/nineSlice/cuts.ts';
import {
  asGiven,
  backgroundText,
  clearBackground,
  DARK_GROUND,
  isClearRound,
  opaque,
  standsOnChecks,
  standsOnDarkGround,
} from './lib/nineSlice/background.ts';
import type { Background } from './lib/nineSlice/background.ts';
import { borderFileFor, contentOf, innerDepths, mirroredSquare, scaledFile } from './lib/nineSlice/frame.ts';
import { readNineSliceRecipe, recipeText } from './lib/nineSlice/recipe.ts';
import type { NineSliceRecipe } from './lib/nineSlice/recipe.ts';
import { gapsIn, joined, spanLength, tilesBetween } from './lib/nineSlice/tiles.ts';
import type { Span } from './lib/nineSlice/tiles.ts';
import { loadSharp } from './lib/sharp.ts';

const HELP = `
nine-slice - make a border for the game from a picture of a frame

  node nine-slice.ts <picture> --name <name> [options]   make a border from a picture
  node nine-slice.ts <name>.recipe.json [--out <folder>] make it again, the same way
  node nine-slice.ts --look <picture>                    say how it would cut a picture, write nothing

A border is a framed box the game lays round a box of any size: its four corners drawn once and
its edges repeated or stretched between them. It is cut out of a picture an image model painted:
nine tiles with white, black or engraved lines between them, or a frame painted whole, with none,
whose edges repeat between its corners. It finds the cuts itself; when it cannot, or finds them
wrong, say them with --cuts.

It writes three files into the folder you are in, or into --out:

  <name>.webp          the border, for world\\ui\\borders\\
  <name>.json          where it is cut and where its words start, for world\\ui\\borders\\
  <name>.recipe.json   how it was made, to make it again: node nine-slice.ts <name>.recipe.json

and says at the end exactly what it wrote and where. A few seconds. Copy the first two into
world\\ui\\borders\\ for the game; keep the recipe with your picture, not there, because the game
would take it for a border's file of cuts.

Options:
  --name <name>        what the border is called: lowercase words joined by hyphens
  --out <folder>       where to write. Default: the folder you are in.
  --repeat <how>       how the edges are laid between the corners: round (the default, a whole
                       number of times), stretch, repeat or space
  --cuts <t,r,b,l>     where to cut, in from the top, right, bottom and left, in the picture's own
                       pixels, for a picture with no lines between its tiles
  --background <what>  what the frame stands on, cleared away: auto (the default), none (it runs
                       to the edge and all of it is kept), alpha (it is transparent round the
                       frame; what is nearly so is cleared), checker (painted grey and white
                       checks), or a number, for a gilt frame on stone: anything less warm than
                       that is cleared, 30 is a start. 30,dark:110 clears only what is darker
                       than 110 as well, for pale clouds on a night sky. auto takes a dark, cool
                       edge for 30,dark:110 and anything else it cannot tell for none
  --fill <name>        make the middle a fill of its own, <name>.webp, instead of keeping it
  --clear-middle       drop the middle, for a fill the game lays under the border
  --width <px>         how wide to make the border, its height and cuts scaled with it. The game
                       shows a border at a quarter of its pixels, so a 1254 picture makes corners
                       some 100 px across on screen and --width 448 makes them about 37
  --content <t,r,b,l>  where its words start, in from each edge, when what it works out is wrong,
                       in the picture's own pixels, before --width
  --look <picture>     say what a picture is and how it would be cut, and write nothing
  --help               this

Needs sharp: run  npm install  in this folder once.

  node nine-slice.ts "E:\\Hämtade filer\\frame.png" --name cloud-sunburst
  node nine-slice.ts frame.png --name column-science --cuts 395,365,400,365 --out made
  node nine-slice.ts cloud-sunburst.recipe.json
  node nine-slice.ts cloud-sunburst.recipe.json --width 448
`;

/** How far past the frame and its ornaments the words start, when nothing says: two shown. */
const CONTENT_MARGIN = 8;

/** How the border and its fill are written: what the program's cut then cuts at 1x, 2x and 3x. */
const BORDER_WEBP = { quality: 92, alphaQuality: 100, effort: 6 } as const;
const FILL_WEBP = { quality: 90 } as const;

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    out: { type: 'string' },
    repeat: { type: 'string' },
    cuts: { type: 'string' },
    background: { type: 'string' },
    fill: { type: 'string' },
    'clear-middle': { type: 'boolean', default: false },
    content: { type: 'string' },
    width: { type: 'string' },
    look: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function fail(message: string): never {
  console.error(`\n${message}\n\nnode nine-slice.ts --help says how to run it.`);
  process.exit(1);
}

if (values.help || (positionals.length === 0 && values.look === undefined)) {
  console.log(HELP);
  process.exit(0);
}

const sharp = await loadSharp();

async function decode(file: string): Promise<Rgba> {
  const { data, info } = await sharp(readFileSync(file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

const sidesFrom = (text: string, what: string): Sides => {
  const parts = text.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    fail(`${what} is four whole numbers of pixels, top, right, bottom and left: ${what} 120,160,136,136`);
  }
  return parts as unknown as Sides;
};

const widthFrom = (text: string): number => {
  const width = Number(text);
  if (!Number.isInteger(width) || width < 16)
    fail('--width is a whole number of pixels, 16 or more: --width 448');
  return width;
};

function backgroundFrom(text: string | undefined, image: Rgba): { background: Background; why: string } {
  if (text === undefined || text === 'auto') {
    if (isClearRound(image)) return { background: 'alpha', why: 'it is transparent round the frame' };
    if (standsOnChecks(image)) return { background: 'checker', why: 'its edge is painted checks' };
    if (standsOnDarkGround(image)) {
      return {
        background: { ...DARK_GROUND },
        why: 'its edge is a dark, cool ground, like night or black stone',
      };
    }
    return {
      background: 'none',
      why: 'it stands on nothing that could be told from it, so all of it is kept',
    };
  }
  if (text === 'none' || text === 'alpha' || text === 'checker') {
    return { background: text, why: 'as --background says' };
  }
  const [warmthText, darkText, ...more] = text.split(',');
  const warmth = Number(warmthText);
  const darker = darkText?.startsWith('dark:') ? Number(darkText.slice('dark:'.length)) : undefined;
  const badDark = darkText !== undefined && !(Number.isInteger(darker) && darker! > 0 && darker! <= 255);
  if (more.length > 0 || badDark || !Number.isInteger(warmth) || warmth <= 0 || warmth >= 255) {
    fail(
      '--background is auto, none, alpha, checker, or a warmth from 1 to 254, like 30, and perhaps how dark\n' +
        'too, like 30,dark:110: only what is both cooler and darker than that is cleared',
    );
  }
  return {
    background: darker === undefined ? { warmth } : { warmth, darker },
    why: 'as --background says',
  };
}

interface Tiles {
  columns: readonly [Span, Span, Span];
  rows: readonly [Span, Span, Span];
  how: string;
}

/** Where the nine tiles are: as said, or between lines it finds, or where the edges start repeating. */
function tilesOf(image: Rgba, cuts: Sides | undefined): Tiles {
  if (cuts !== undefined) {
    return { ...tilesAt(cuts, image.width, image.height), how: 'cut where --cuts says' };
  }
  const gaps = gapsIn(image);
  if (gaps.shade !== null && gaps.columns.length === 2 && gaps.rows.length === 2) {
    return {
      columns: tilesBetween(gaps.columns, image.width),
      rows: tilesBetween(gaps.rows, image.height),
      how: `cut out the ${gaps.shade === 'light' ? 'white' : 'black'} lines between the tiles`,
    };
  }
  const lines = linesIn(image);
  if (lines !== null) {
    return {
      columns: tilesBetween(lines.columns, image.width),
      rows: tilesBetween(lines.rows, image.height),
      how: 'cut out the thin or engraved lines between the tiles',
    };
  }
  const edges = cutsFromEdges(image);
  if (edges !== null) {
    return {
      ...tilesAt(edges, image.width, image.height),
      how: 'cut where the edges start repeating, as there are no lines between the tiles',
    };
  }
  fail(
    'it found no lines between the tiles and could not tell the edges from the corners. Say where to\n' +
      "cut it with --cuts top,right,bottom,left, in the picture's own pixels: --look shows its size.",
  );
}

const spans = (three: readonly Span[]) => three.map(([from, to]) => `${from}-${to}`).join(', ');

/** Makes a border from a picture by a recipe, writes it, and says what it wrote and where. */
async function make(name: string, picture: string, recipe: NineSliceRecipe, out: string, how: string) {
  const outputs = [
    `${name}.webp`,
    `${name}.json`,
    `${name}.recipe.json`,
    ...(recipe.fill ? [`${recipe.fill}.webp`] : []),
  ];
  for (const file of outputs) {
    if (resolve(out, file) === picture) {
      fail(`writing ${file} into ${out} would write over the picture it is made from: give another --out`);
    }
  }
  const given = await decode(picture);
  const image = asGiven(given, recipe.background);
  const { columns, rows } = recipe as Required<Pick<NineSliceRecipe, 'columns' | 'rows'>>;
  const middle = recipe.middle === true;
  const frame = clearBackground(joined(image, columns, rows, !middle), recipe.background, !middle);
  const slice: Sides = [
    spanLength(rows[0]),
    spanLength(columns[2]),
    spanLength(rows[2]),
    spanLength(columns[0]),
  ];
  const content = recipe.content ?? contentOf(frame, slice, CONTENT_MARGIN);
  const factor = recipe.width === undefined ? 1 : recipe.width / frame.width;
  const sized = (length: number) => Math.max(1, Math.round(length * factor));
  const file: BorderFile = scaledFile(
    borderFileFor(slice, innerDepths(frame, slice), recipe.repeat, content, middle),
    factor,
  );
  const [width, height] = [sized(frame.width), sized(frame.height)];

  const written: [string, string][] = [];
  const webp = resolve(out, `${name}.webp`);
  const raw = { raw: { width: frame.width, height: frame.height, channels: 4 as const } };
  await (
    factor === 1
      ? sharp(Buffer.from(frame.data), raw)
      : sharp(Buffer.from(frame.data), raw).resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
  )
    .webp(BORDER_WEBP)
    .toFile(webp);
  const shown = (length: number) => Math.round(length / 4);
  written.push([
    webp,
    `the border, ${width} by ${height}; the game shows it at a quarter of that, its corners ` +
      `${shown(file.slice[3])} and ${shown(file.slice[1])} px across`,
  ]);
  const json = resolve(out, `${name}.json`);
  const oneLine = (_: string, inside: string) => `[${inside.replace(/\s+/g, ' ')}]`;
  writeFileSync(json, `${JSON.stringify(file, null, 2).replace(/\[\s+([^\]]*?)\s+\]/g, oneLine)}\n`);
  written.push([
    json,
    `its cuts, ${file.slice.join(' ')}, and where its words start, ${file.content!.join(' ')}`,
  ]);
  const recipeFile = resolve(out, `${name}.recipe.json`);
  const fromOut = relative(out, picture).split(sep).join('/');
  writeFileSync(recipeFile, recipeText({ ...recipe, picture: fromOut }));
  written.push([recipeFile, `how it was made; node nine-slice.ts ${name}.recipe.json makes it again`]);
  if (recipe.fill !== undefined) {
    const fill = mirroredSquare(image, columns[1], rows[1]);
    const fillFile = resolve(out, `${recipe.fill}.webp`);
    await sharp(Buffer.from(fill.data), { raw: { width: fill.width, height: fill.height, channels: 4 } })
      .resize(sized(fill.width), sized(fill.height), { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha()
      .webp(FILL_WEBP)
      .toFile(fillFile);
    written.push([
      fillFile,
      `the middle made a fill, ${sized(fill.width)} by ${sized(fill.height)}, for world\\ui\\fills\\`,
    ]);
  }

  console.log(`\n${name}, from ${picture}, ${given.width} by ${given.height}:`);
  console.log(`  ${how}: columns ${spans(columns)}, rows ${spans(rows)}`);
  console.log(
    `  ${backgroundText(recipe.background)} background, edges laid ${recipe.repeat}, middle ${middle ? 'kept' : recipe.fill ? `made the fill ${recipe.fill}` : 'dropped'}`,
  );
  console.log(`\nWrote ${written.length} files:\n`);
  for (const [path, what] of written) {
    console.log(`  ${path}\n      ${what}`);
  }
  console.log(
    `\nThe game reads ${name}.webp and ${name}.json from world\\ui\\borders\\: copy those two there. Keep the\n` +
      'recipe with your picture rather than there, where the game would take it for a file of cuts.',
  );
}

if (values.look !== undefined) {
  const picture = resolve(values.look);
  if (!existsSync(picture)) fail(`there is no picture ${picture}`);
  const image = await decode(picture);
  const { background, why } = backgroundFrom(values.background, image);
  const tiles = tilesOf(background === 'alpha' ? image : opaque(image), undefined);
  console.log(`\n${picture}: ${image.width} by ${image.height}`);
  console.log(`  it would ${tiles.how}: columns ${spans(tiles.columns)}, rows ${spans(tiles.rows)}`);
  console.log(
    `  so the corners would be ${spanLength(tiles.columns[0])} and ${spanLength(tiles.columns[2])} wide, ` +
      `${spanLength(tiles.rows[0])} and ${spanLength(tiles.rows[2])} tall`,
  );
  console.log(`  background ${typeof background === 'string' ? background : background.warmth}: ${why}`);
  console.log('\nNothing was written.');
  process.exit(0);
}

const [input] = positionals;
const out = resolve(values.out ?? process.cwd());
if (!existsSync(out)) fail(`there is no folder ${out} to write into`);

if (input!.endsWith('.json')) {
  const recipePath = resolve(input!);
  if (!existsSync(recipePath)) fail(`there is no recipe ${recipePath}`);
  const recipe = readNineSliceRecipe(readFileSync(recipePath, 'utf8'), recipePath);
  const picture = resolve(dirname(recipePath), recipe.picture);
  if (!existsSync(picture)) fail(`${recipePath} is made from ${picture}, which is not there`);
  const name = basename(recipePath).replace(/(\.recipe)?\.json$/, '');
  let tiles: Tiles = { columns: recipe.columns!, rows: recipe.rows!, how: 'cut where the recipe says' };
  if (recipe.columns === undefined || recipe.rows === undefined) {
    const image = await decode(picture);
    tiles = tilesOf(recipe.background === 'alpha' ? image : opaque(image), undefined);
  }
  const width = values.width === undefined ? recipe.width : widthFrom(values.width);
  await make(
    name,
    picture,
    { ...recipe, columns: tiles.columns, rows: tiles.rows, ...(width === undefined ? {} : { width }) },
    out,
    tiles.how,
  );
} else {
  const picture = resolve(input!);
  if (!existsSync(picture)) fail(`there is no picture ${picture}`);
  const name = values.name ?? fail('say what to call the border: --name cloud-sunburst');
  if (!NAME.test(name)) fail(`--name is lowercase words joined by hyphens, like cloud-sunburst, not ${name}`);
  const repeat = (values.repeat ?? 'round') as Repeat;
  if (!(REPEATS as readonly string[]).includes(repeat)) fail(`--repeat is one of ${REPEATS.join(', ')}`);
  if (values.fill !== undefined && !NAME.test(values.fill)) fail('--fill is a name, like dark-felt');
  if (values.fill !== undefined && values['clear-middle'])
    fail('--fill and --clear-middle both say what the middle is: choose one');
  const image = await decode(picture);
  const { background, why } = backgroundFrom(values.background, image);
  const tiles = tilesOf(
    background === 'alpha' ? image : opaque(image),
    values.cuts === undefined ? undefined : sidesFrom(values.cuts, '--cuts'),
  );
  const recipe: NineSliceRecipe = {
    picture,
    background,
    columns: tiles.columns,
    rows: tiles.rows,
    repeat,
    ...(values.fill === undefined && !values['clear-middle'] ? { middle: true } : {}),
    ...(values.fill === undefined ? {} : { fill: values.fill }),
    ...(values.width === undefined ? {} : { width: widthFrom(values.width) }),
    ...(values.content === undefined ? {} : { content: sidesFrom(values.content, '--content') }),
  };
  console.log(`background ${backgroundText(background)}: ${why}`);
  await make(name, picture, recipe, out, tiles.how);
}

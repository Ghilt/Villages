/**
 * Cuts the pictures in `world/sprites/` into what the game draws: one atlas and the frames in it.
 *
 * Any picture will do - PNG, WebP or JPEG, any size, on a flat background or a transparent one, or
 * standing on a little diorama plinth of turf and soil, which is lifted off. Each is keyed, trimmed to what
 * is in it, stood on its foot, shrunk to the one size it is ever needed at, and packed. What is decided
 * about the pixels is `src/art.ts` and `src/lift.ts`; this reads, resizes and writes, and remembers what
 * it cut so that a save re-cuts only the picture that was saved.
 *
 *     npm run world:art --prefix frontend
 *     npm run world:art --prefix frontend -- --placeholders
 *
 * `--placeholders` first draws a placeholder for every sprite that has no picture, and **never draws over
 * a file that is there**: delete one to have its placeholder back. The dev server runs this by itself
 * whenever something in the folder is saved and every time it starts, and so does the quick start, so a
 * cut that finds nothing new writes nothing. See decision record 0059.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { extname, resolve } from 'node:path';

import sharp from 'sharp';

import {
  backgroundOf,
  crop,
  footOf,
  hasOwnAlpha,
  keyOut,
  opaqueBox,
  packShelves,
  shadowOf,
} from '../src/art.ts';
import type { ArtAtlasFile, ArtFrame, Rgba } from '../src/art.ts';
import type { BiomeFile } from '../src/biome.ts';
import { findPlinth, liftOffPlinth } from '../src/lift.ts';
import { MARK_NAMES, markPlaceholderSvg, sceneryPlaceholderSvg } from '../src/placeholderArt.ts';
import { ART_CACHE_DIR, ART_DIR, BIOMES, PAINTERLY_DIR, RENDER, SPRITES_DIR } from './lib/paths.ts';

/**
 * How tall every scenery sprite is cut, in pixels.
 *
 * Twice the tallest any kind is ever drawn: an oak of 4.8 world units, grown by its most vary, at
 * sixteen pixels a unit at the closest zoom, is 92 pixels. Twice that holds on a display at 200 per
 * cent, and the mipmaps the browser builds from it cover the other end, where a kind arrives at twenty.
 * So there is one size and no versions per zoom.
 */
const SCENERY_HEIGHT = 192;

/** Clear pixels around every frame, so the mipmaps never pull one sprite into its neighbour. */
const PAD = 2;

/** The widest the atlas is allowed to grow before it starts a new shelf. */
const WIDEST = 1024;

const PICTURES = new Set(['.png', '.webp', '.jpg', '.jpeg']);

/** Where the tool keeps the hash of every placeholder it drew, so a picture can be told from one. */
const PLACEHOLDERS = resolve(SPRITES_DIR, 'placeholders.json');

const drawPlaceholders = process.argv.includes('--placeholders');

const kinds = (JSON.parse(readFileSync(BIOMES, 'utf8')) as BiomeFile).kinds.map((kind) => kind.name);

const hashOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function readPlaceholders(): Record<string, string> {
  return existsSync(PLACEHOLDERS)
    ? (JSON.parse(readFileSync(PLACEHOLDERS, 'utf8')) as Record<string, string>)
    : {};
}

/** The pictures in one group's folder, by name, refusing two files that would both be the same sprite. */
function picturesIn(group: string): Map<string, string> {
  const folder = resolve(SPRITES_DIR, group);
  const found = new Map<string, string>();
  if (!existsSync(folder)) {
    return found;
  }
  for (const file of readdirSync(folder).sort()) {
    const extension = extname(file).toLowerCase();
    if (!PICTURES.has(extension)) {
      continue;
    }
    const name = file.slice(0, -extension.length);
    const already = found.get(name);
    if (already !== undefined) {
      throw new Error(`${group}/${already} and ${group}/${file} are both ${name}; keep one of them`);
    }
    found.set(name, file);
  }
  return found;
}

async function placeholders(): Promise<void> {
  const known = readPlaceholders();
  let drawn = 0;
  let kept = 0;
  for (const [group, names, draw] of [
    ['scenery', kinds, sceneryPlaceholderSvg],
    ['marks', MARK_NAMES, markPlaceholderSvg],
  ] as const) {
    mkdirSync(resolve(SPRITES_DIR, group), { recursive: true });
    const there = picturesIn(group);
    for (const name of names) {
      if (there.has(name)) {
        kept += 1;
        continue;
      }
      const bytes = await sharp(Buffer.from(draw(name)))
        .png({ compressionLevel: 9 })
        .toBuffer();
      writeFileSync(resolve(SPRITES_DIR, group, `${name}.png`), bytes);
      known[`${group}/${name}.png`] = hashOf(bytes);
      drawn += 1;
      console.log(`drew  ${group}/${name}.png`);
    }
  }
  const sorted = Object.fromEntries(Object.entries(known).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(PLACEHOLDERS, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`${drawn} placeholders drawn and ${kept} pictures kept, in ${SPRITES_DIR}\n`);
}

interface Cut {
  name: string;
  file: string;
  pixels: Buffer;
  width: number;
  height: number;
  footX: number;
  footY: number;
  placeholder: boolean;
  /** Cut this time, rather than read back from the cache. */
  fresh: boolean;
  said: string;
}

/**
 * What a cut depends on besides the picture: the rules the pixels go through, and the size they are cut
 * to. Read from the rules' own files, so that changing a rule re-cuts every picture and nothing else does.
 */
const RULES = hashOf(
  Buffer.concat([
    readFileSync(new URL('../src/art.ts', import.meta.url)),
    readFileSync(new URL('../src/lift.ts', import.meta.url)),
    Buffer.from(String(SCENERY_HEIGHT)),
  ]),
).slice(0, 16);

/** The cuts this run used, so that the cache holds nothing else when it is done. */
const kept = new Set<string>();

/** What is kept of a cut besides its pixels, so that one read back from the cache says what it said. */
interface Remembered {
  width: number;
  height: number;
  footX: number;
  source: string;
  trimmed: string;
  how: string;
}

async function cutOne(
  group: string,
  name: string,
  file: string,
  known: Record<string, string>,
): Promise<Cut> {
  const path = resolve(SPRITES_DIR, group, file);
  const bytes = readFileSync(path);
  const placeholder = known[`${group}/${file}`] === hashOf(bytes);
  const say = (cut: Remembered, from: string) =>
    `${placeholder ? 'placeholder' : 'PICTURE    '} ${`${group}/${file}`.padEnd(24)} ` +
    `${cut.source} -> trimmed ${cut.trimmed} -> ${cut.width}x${cut.height}, ${cut.how}, ` +
    `foot ${((cut.footX / cut.width) * 100).toFixed(0)}% across${from}`;

  const key = `${hashOf(bytes).slice(0, 24)}-${RULES}`;
  kept.add(key);
  const cachedPixels = resolve(ART_CACHE_DIR, `${key}.raw`);
  const cachedCut = resolve(ART_CACHE_DIR, `${key}.json`);
  if (existsSync(cachedPixels) && existsSync(cachedCut)) {
    const cut = JSON.parse(readFileSync(cachedCut, 'utf8')) as Remembered;
    const pixels = readFileSync(cachedPixels);
    if (pixels.length === cut.width * cut.height * 4) {
      return {
        name,
        file,
        pixels,
        ...cut,
        footY: cut.height,
        placeholder,
        fresh: false,
        said: say(cut, ', as cut before'),
      };
    }
  }

  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const picture: Rgba = {
    width: info.width,
    height: info.height,
    data: new Uint8Array(data.buffer, data.byteOffset, data.length),
  };
  let keyed;
  let how;
  try {
    // A diorama is lifted off its plinth; anything else is keyed off its paper, or keeps its own alpha.
    const plinth = hasOwnAlpha(picture) ? null : findPlinth(picture);
    keyed = plinth === null ? keyOut(picture) : liftOffPlinth(picture, plinth, backgroundOf(picture));
    how =
      plinth !== null
        ? `lifted off its plinth, paper rgb(${keyed.background!.join(',')})`
        : keyed.background === null
          ? 'its own alpha'
          : `keyed rgb(${keyed.background.join(',')})`;
  } catch (cause) {
    throw new Error(`${group}/${file}: ${(cause as Error).message}`, { cause });
  }
  const box = opaqueBox(keyed.image);
  if (box === null) {
    throw new Error(`${group}/${file} has nothing in it once its background is taken away`);
  }
  const trimmed = crop(keyed.image, box);
  const foot = footOf(trimmed);
  const scale = Math.min(1, SCENERY_HEIGHT / trimmed.height);
  const height = Math.max(1, Math.round(trimmed.height * scale));
  const width = Math.max(1, Math.round(trimmed.width * scale));
  const pixels = await sharp(Buffer.from(trimmed.data), {
    raw: { width: trimmed.width, height: trimmed.height, channels: 4 },
  })
    .resize(width, height, { kernel: 'lanczos3', fit: 'fill' })
    .raw()
    .toBuffer();
  const cut: Remembered = {
    width,
    height,
    footX: (foot.x / trimmed.width) * width,
    source: `${info.width}x${info.height}`,
    trimmed: `${trimmed.width}x${trimmed.height}`,
    how,
  };
  mkdirSync(ART_CACHE_DIR, { recursive: true });
  writeFileSync(cachedPixels, pixels);
  writeFileSync(cachedCut, JSON.stringify(cut));
  return { name, file, pixels, ...cut, footY: height, placeholder, fresh: true, said: say(cut, '') };
}

/**
 * Whether the atlas already in `public/art/` is the one this cut makes: the same pixels, and the same
 * frames in the same places, whenever it was cut.
 */
function alreadyThere(file: ArtAtlasFile, atlas: Buffer): boolean {
  try {
    const there = JSON.parse(readFileSync(resolve(ART_DIR, 'scenery.json'), 'utf8')) as ArtAtlasFile;
    return (
      readFileSync(resolve(ART_DIR, 'scenery.webp')).equals(atlas) &&
      JSON.stringify({ ...file, cutAt: there.cutAt }) === JSON.stringify(there)
    );
  } catch {
    // Not there, or not readable: either way, not this one.
    return false;
  }
}

/** A colour from `world/render.json`, for the ground the contact sheet stands the sprites on. */
function groundColour(name: string, fallback: string): string {
  const render = JSON.parse(readFileSync(RENDER, 'utf8')) as { colours?: Record<string, string> };
  return render.colours?.[name] ?? fallback;
}

/**
 * Every sprite at the three sizes it is actually drawn at, on the ground it is drawn over.
 *
 * Shrunk by sharp rather than by a graphics card, which is close to what mipmaps do and not identical to
 * it. What it is for is the question a picture cannot answer at full size: whether the thing still reads
 * at twenty pixels, and whether it disappears into the forest it stands in.
 */
async function contactSheet(cuts: readonly Cut[]): Promise<string> {
  const sizes = [20, 40, 80];
  const grounds = [
    ['broadleaf-forest', groundColour('broadleaf-forest', '#9dbc7e')],
    ['taiga', groundColour('taiga', '#6e9078')],
    ['meadow', groundColour('meadow', '#c4ce8d')],
  ] as const;
  const cellWidth = 96;
  const cellHeight = 100;
  const labelWidth = 210;
  const width = labelWidth + sizes.length * grounds.length * cellWidth;
  const height = 30 + cuts.length * cellHeight;
  const bands = grounds
    .map(([, colour], index) =>
      sizes
        .map(
          (_, at) =>
            `<rect x="${labelWidth + (index * sizes.length + at) * cellWidth}" y="0" width="${cellWidth}" ` +
            `height="${height}" fill="${colour}"/>`,
        )
        .join(''),
    )
    .join('');
  const headings = grounds
    .map(([ground], index) =>
      sizes
        .map(
          (size, at) =>
            `<text x="${labelWidth + (index * sizes.length + at) * cellWidth + 6}" y="18" font-size="12" ` +
            `font-family="sans-serif" fill="#222">${ground.slice(0, 8)} ${size}px</text>`,
        )
        .join(''),
    )
    .join('');
  const labels = cuts
    .map(
      (cut, row) =>
        `<text x="8" y="${30 + row * cellHeight + cellHeight / 2}" font-size="14" font-family="sans-serif" ` +
        `fill="${cut.placeholder ? '#666' : '#000'}">${cut.name}${cut.placeholder ? ' (placeholder)' : ''}</text>`,
    )
    .join('');
  const base = sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        `<rect width="100%" height="100%" fill="#f4f1e8"/>${bands}${headings}${labels}</svg>`,
    ),
  );
  const layers: sharp.OverlayOptions[] = [];
  for (const [row, cut] of cuts.entries()) {
    for (let ground = 0; ground < grounds.length; ground += 1) {
      for (const [at, size] of sizes.entries()) {
        const tall = Math.min(size, cut.height);
        const wide = Math.max(1, Math.round((cut.width * tall) / cut.height));
        const small = await sharp(cut.pixels, { raw: { width: cut.width, height: cut.height, channels: 4 } })
          .resize(wide, tall, { kernel: 'lanczos3', fit: 'fill' })
          .png()
          .toBuffer();
        const column = ground * sizes.length + at;
        const footX = labelWidth + column * cellWidth + cellWidth / 2;
        const footY = 30 + row * cellHeight + cellHeight - 8;
        layers.push({
          input: small,
          left: Math.round(footX - (cut.footX / cut.width) * wide),
          top: Math.round(footY - tall),
        });
      }
    }
  }
  mkdirSync(PAINTERLY_DIR, { recursive: true });
  const out = resolve(PAINTERLY_DIR, 'art-sheet.png');
  await base.composite(layers).png().toFile(out);
  return out;
}

/**
 * Forgets the placeholders that are no longer in the folder, and says which.
 *
 * A placeholder is gone when a picture was saved over it, and when `spruce.jpg` replaced `spruce.png` and
 * the one was deleted to keep the other. Its record would otherwise outlive it - which the folder's own
 * test calls a broken folder, for a change that was exactly the one meant.
 */
function forgetReplacedPlaceholders(): Record<string, string> {
  const known = readPlaceholders();
  const gone = Object.keys(known).filter((file) => {
    const path = resolve(SPRITES_DIR, file);
    return !existsSync(path) || hashOf(readFileSync(path)) !== known[file];
  });
  if (gone.length > 0) {
    for (const file of gone) {
      delete known[file];
    }
    writeFileSync(PLACEHOLDERS, `${JSON.stringify(known, null, 2)}\n`);
    const count = gone.length === 1 ? 'a placeholder' : `${gone.length} placeholders`;
    console.log(`forgot ${count} no longer in the folder: ${gone.join(', ')}`);
  }
  return known;
}

async function cutScenery(): Promise<void> {
  const known = forgetReplacedPlaceholders();
  const there = picturesIn('scenery');
  const missing = kinds.filter((kind) => !there.has(kind));
  if (missing.length > 0) {
    throw new Error(
      `world/sprites/scenery has no picture for ${missing.join(', ')}. ` +
        'Run npm run world:art --prefix frontend -- --placeholders to draw one for each.',
    );
  }
  const extra = [...there.keys()].filter((name) => !kinds.includes(name));

  const cuts: Cut[] = [];
  for (const kind of kinds) {
    const cut = await cutOne('scenery', kind, there.get(kind)!, known);
    cuts.push(cut);
    console.log(cut.said);
  }

  // Every sprite's shadow too, from the cut sprite itself, into the same atlas: a particle layer draws
  // from one texture, and the shadows are a particle layer of their own. See experiment 0013.
  const shadows = cuts.map((cut) =>
    shadowOf({ width: cut.width, height: cut.height, data: new Uint8Array(cut.pixels) }, cut.footX),
  );
  const pieces = [
    ...cuts.map((cut) => ({ width: cut.width, height: cut.height, pixels: cut.pixels })),
    ...shadows.map((shadow) => ({
      width: shadow.image.width,
      height: shadow.image.height,
      pixels: Buffer.from(shadow.image.data),
    })),
  ];
  const packed = packShelves(pieces, PAD, WIDEST);
  const atlas = await sharp({
    create: {
      width: packed.width,
      height: packed.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(
      pieces.map((piece, index) => ({
        input: piece.pixels,
        raw: { width: piece.width, height: piece.height, channels: 4 as const },
        left: packed.placed[index]!.x,
        top: packed.placed[index]!.y,
      })),
    )
    .webp({ lossless: true, effort: 6 })
    .toBuffer();

  const frames: Record<string, ArtFrame> = {};
  const shadowFrames: Record<string, ArtFrame> = {};
  for (const [index, cut] of cuts.entries()) {
    frames[cut.name] = {
      x: packed.placed[index]!.x,
      y: packed.placed[index]!.y,
      width: cut.width,
      height: cut.height,
      footX: Math.round(cut.footX * 100) / 100,
      footY: cut.footY,
      placeholder: cut.placeholder,
      source: cut.file,
    };
    const shadow = shadows[index]!;
    const at = packed.placed[cuts.length + index]!;
    shadowFrames[cut.name] = {
      x: at.x,
      y: at.y,
      width: shadow.image.width,
      height: shadow.image.height,
      footX: Math.round(shadow.footX * 100) / 100,
      footY: shadow.footY,
      placeholder: cut.placeholder,
      source: cut.file,
    };
  }
  const file: ArtAtlasFile = {
    version: hashOf(atlas).slice(0, 12),
    cutAt: new Date().toISOString(),
    width: packed.width,
    height: packed.height,
    bytes: atlas.length,
    frames,
    shadows: shadowFrames,
  };
  // Nothing new is nothing written. The dev server and the quick start cut at every start, and the page
  // lets go of every tree and gathers them all again whenever the atlas changes, so the same atlas written
  // again would be a blink of the whole map for nothing. When it was cut stays when it was.
  const same = alreadyThere(file, atlas);
  if (!same) {
    mkdirSync(ART_DIR, { recursive: true });
    writeFileSync(resolve(ART_DIR, 'scenery.webp'), atlas);
    // The frames last, because the browser reads them first: a half-written cut is never announced.
    writeFileSync(resolve(ART_DIR, 'scenery.json'), `${JSON.stringify(file, null, 2)}\n`);
  }

  const pictures = cuts.filter((cut) => !cut.placeholder).map((cut) => cut.name);
  const fresh = cuts.filter((cut) => cut.fresh).map((cut) => cut.name);
  // Last on the line, after a dash, because the quick start shows only this part of what was said.
  const news = same
    ? 'nothing new'
    : fresh.length === cuts.length
      ? 'every sprite newly cut'
      : fresh.length > 0
        ? `newly cut: ${fresh.join(', ')}`
        : 'written again from the cuts kept';
  console.log(
    `\nscenery: ${pictures.length === 0 ? 'no pictures yet' : `${pictures.join(', ')} drawn by Adam`}, ` +
      `${cuts.length - pictures.length} placeholders; atlas ${packed.width}x${packed.height}, ` +
      `${(atlas.length / 1024).toFixed(0)} kB, version ${file.version} - ${news}`,
  );
  if (extra.length > 0) {
    console.log(`not a kind in world/biomes.json, so not cut: ${extra.join(', ')}`);
  }
  const marks = picturesIn('marks');
  const markPictures = MARK_NAMES.filter((name) => {
    const found = marks.get(name);
    return (
      found !== undefined &&
      known[`marks/${found}`] !== hashOf(readFileSync(resolve(SPRITES_DIR, 'marks', found)))
    );
  });
  console.log(
    `marks: ${marks.size} of ${MARK_NAMES.length} there` +
      `${markPictures.length > 0 ? `, ${markPictures.join(', ')} drawn by Adam` : ''}; not drawn from files yet`,
  );
  console.log(`contact sheet: ${await contactSheet(cuts)}`);
  const newest = Math.max(...cuts.map((cut) => statSync(resolve(SPRITES_DIR, 'scenery', cut.file)).mtimeMs));
  console.log(`newest picture saved ${new Date(newest).toLocaleString()}`);
  // The cache keeps the cuts of the pictures that are there under the rules that are there, and no more:
  // a picture saved over, or a rule changed, leaves its old cut behind otherwise, every time.
  for (const file of existsSync(ART_CACHE_DIR) ? readdirSync(ART_CACHE_DIR) : []) {
    if (!kept.has(file.replace(/\.(raw|json)$/, ''))) {
      unlinkSync(resolve(ART_CACHE_DIR, file));
    }
  }
}

try {
  if (drawPlaceholders) {
    await placeholders();
  }
  await cutScenery();
} catch (cause) {
  console.error(`world:art failed: ${(cause as Error).message}`);
  process.exit(1);
}

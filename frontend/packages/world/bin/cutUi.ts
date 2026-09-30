/**
 * Cuts the pictures in `world/ui/` into what the page draws: every picture at 1x, 2x and 3x, and a list
 * of them the page reads first.
 *
 * Every picture in the folder is painted at four times the size it is shown, so a picture's size as shown
 * is its own divided by four, and each density is cut from it rather than stretched up to. A picture with
 * a flat background has it keyed away, as a sprite's is; a fill is kept opaque and cut so that it still
 * repeats without a seam at every density. What is decided about the pixels and the numbers is
 * `src/uiArt.ts`; this reads, resizes and writes, and remembers what it cut so that a save re-cuts only
 * the picture that was saved.
 *
 *     npm run world:ui --prefix frontend
 *     npm run world:ui --prefix frontend -- --placeholders
 *
 * `--placeholders` first makes a placeholder for every name in `src/uiPlaceholders.ts` that has no
 * picture - cut from the moodboard, or drawn - and **never writes over a file that is there**: delete one
 * to have its placeholder back. The dev server runs this whenever a picture in the folder is saved and
 * every time it starts, and a cut that finds nothing new writes nothing. See decision record 0068.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';

import sharp from 'sharp';

import { hasOwnAlpha, keyOut } from '../src/art.ts';
import type { Rgba } from '../src/art.ts';
import {
  CUT_AT,
  PAINTED_AT,
  UI_BUDGET,
  UI_KINDS,
  UI_PICTURES,
  asShown,
  borderAsShown,
  nameProblem,
  outlineMask,
  readBorderFile,
  weightAt,
} from '../src/uiArt.ts';
import type { BorderFile, Sides, UiArtFile, UiCut, UiKind, UiPicture } from '../src/uiArt.ts';
import { paintFill } from '../src/uiFills.ts';
import { MOODBOARD_SIZE, UI_PLACEHOLDERS, placeholderAbout } from '../src/uiPlaceholders.ts';
import type { CutPlaceholder, UiPlaceholder } from '../src/uiPlaceholders.ts';
import { UI_CACHE_DIR, UI_DIR, UI_OUT_DIR } from './paths.ts';

/** Where the tool keeps the hash of every placeholder it made, so a picture can be told from one. */
const PLACEHOLDERS = resolve(UI_DIR, 'placeholders.json');

const MOODBOARD = resolve(UI_DIR, 'moodboard.webp');

/** The kinds a picture has to be cut out for: a thing standing on something, rather than a box or a fill. */
const CUT_OUT: ReadonlySet<UiKind> = new Set(['embellishments', 'medallions', 'marks', 'controls']);

/** How each density is written. Lossy is fine at these sizes, and its alpha is kept nearly whole. */
const WEBP = { quality: 88, alphaQuality: 92, effort: 5 } as const;

const makePlaceholders = process.argv.includes('--placeholders');

const hashOf = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');

/** The cuts this run used, so that the cache holds nothing else when it is done. */
const cutsUsed = new Set<string>();

/**
 * What a cut depends on besides the picture: the rules its pixels go through, and how it is written. Read
 * from the rules' own files, so that changing a rule re-cuts every picture and nothing else does.
 */
const RULES = hashOf(
  Buffer.concat([
    readFileSync(new URL('../src/art.ts', import.meta.url)),
    readFileSync(new URL('../src/uiArt.ts', import.meta.url)),
    Buffer.from(JSON.stringify(WEBP)),
  ]),
).slice(0, 16);

function readPlaceholders(): Record<string, string> {
  return existsSync(PLACEHOLDERS)
    ? (JSON.parse(readFileSync(PLACEHOLDERS, 'utf8')) as Record<string, string>)
    : {};
}

function writePlaceholders(known: Record<string, string>): void {
  const sorted = Object.fromEntries(Object.entries(known).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(PLACEHOLDERS, `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * The pictures in one kind's folder, by name, refusing a file whose name a recipe could not call it by
 * and two files that would both be the same picture. A border's `.json` is not a picture.
 */
function picturesIn(kind: UiKind): Map<string, string> {
  const folder = resolve(UI_DIR, kind);
  const found = new Map<string, string>();
  if (!existsSync(folder)) {
    return found;
  }
  for (const file of readdirSync(folder).sort()) {
    const extension = extname(file).toLowerCase();
    if (extension === '.json' && kind === 'borders') {
      continue;
    }
    if (!UI_PICTURES.has(extension) && extension !== '') {
      throw new Error(`world/ui/${kind}/${file} is not a picture this tool reads: PNG, WebP or JPEG`);
    }
    const problem = nameProblem(file);
    if (problem !== null) {
      throw new Error(`world/ui/${kind}/${problem}`);
    }
    const name = file.slice(0, -extension.length);
    const already = found.get(name);
    if (already !== undefined) {
      throw new Error(`world/ui/${kind}/${already} and ${file} are both ${name}; keep one of them`);
    }
    found.set(name, file);
  }
  return found;
}

// --- placeholders ----------------------------------------------------------------------------------

async function decode(bytes: Buffer): Promise<Rgba> {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Uint8Array(data.buffer, data.byteOffset, data.length),
  };
}

function cropOf(image: Rgba, left: number, top: number, width: number, height: number): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const from = ((top + y) * image.width + left) * 4;
    data.set(image.data.subarray(from, from + width * 4), y * width * 4);
  }
  return { width, height, data };
}

/** The middle colour of a picture's edge, two pixels deep: the ground it stands on. */
function groundOf(image: Rgba): [number, number, number] {
  const channels: number[][] = [[], [], []];
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (x < 2 || y < 2 || x >= image.width - 2 || y >= image.height - 2) {
        const at = (y * image.width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          channels[channel]!.push(image.data[at + channel]!);
        }
      }
    }
  }
  const middle = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  return [middle(channels[0]!), middle(channels[1]!), middle(channels[2]!)];
}

/**
 * Keys a piece of the moodboard off the dark ground it stands on.
 *
 * The moodboard's ground is not one colour - it has a grain and a cloud in it - so the sprites' keying,
 * which refuses a picture whose edge is not flat, is handed the piece inside a ring of its ground's own
 * middle colour. The flood from the edge then runs through whatever is near that colour and stops at the
 * gold, which is what is wanted.
 */
function keyOffItsGround(piece: Rgba): Rgba {
  const ring = 3;
  const [r, g, b] = groundOf(piece);
  const width = piece.width + ring * 2;
  const height = piece.height + ring * 2;
  const data = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    data.set([r, g, b, 255], pixel * 4);
  }
  for (let y = 0; y < piece.height; y += 1) {
    data.set(
      piece.data.subarray(y * piece.width * 4, (y + 1) * piece.width * 4),
      ((y + ring) * width + ring) * 4,
    );
  }
  const keyed = keyOut({ width, height, data }).image;
  return mainPieceOf(cropOf(keyed, ring, ring, piece.width, piece.height));
}

/**
 * Only what joins the biggest thing in a keyed piece: the moodboard's captions and stray lights sit close
 * to what they caption, and a rectangle round a medallion catches a letter of the word above it.
 */
function mainPieceOf(image: Rgba): Rgba {
  const { width, height } = image;
  const solid = (pixel: number) => image.data[pixel * 4 + 3]! > 24;
  const group = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (group[start] !== -1 || !solid(start)) {
      continue;
    }
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    group[start] = id;
    while (stack.length > 0) {
      const pixel = stack.pop()!;
      size += 1;
      const x = pixel % width;
      const y = (pixel - x) / width;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        const next = ny * width + nx;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && group[next] === -1 && solid(next)) {
          group[next] = id;
          stack.push(next);
        }
      }
    }
    sizes.push(size);
  }
  // Anything a twentieth the size of the biggest piece or more stays: a medallion's pendant, a drape's tassel.
  const biggest = Math.max(0, ...sizes);
  const data = new Uint8Array(image.data);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const id = group[pixel]!;
    if (!solid(pixel) || sizes[id]! < biggest / 20) {
      data[pixel * 4 + 3] = 0;
    }
  }
  return { width, height, data };
}

async function cutFromMoodboard(placeholder: CutPlaceholder, board: Rgba): Promise<Buffer> {
  const [left, top, width, height] = placeholder.from;
  let piece = cropOf(board, left, top, width, height);
  if (placeholder.key === true) {
    piece = keyOffItsGround(piece);
  }
  // Four times the size, which is what every picture in world/ui is painted at. Soft, and honest about it.
  const bigWidth = width * PAINTED_AT;
  const bigHeight = height * PAINTED_AT;
  const big = await sharp(Buffer.from(piece.data), { raw: { width, height, channels: 4 } })
    .resize(bigWidth, bigHeight, { kernel: 'lanczos3', fit: 'fill' })
    .raw()
    .toBuffer();
  if (placeholder.outline !== undefined) {
    const outline = placeholder.outline.map(
      ([x, y]) => [(x - left) * PAINTED_AT, (y - top) * PAINTED_AT] as const,
    );
    const mask = outlineMask(bigWidth, bigHeight, outline, PAINTED_AT * 1.5);
    for (let pixel = 0; pixel < bigWidth * bigHeight; pixel += 1) {
      big[pixel * 4 + 3] = Math.round((big[pixel * 4 + 3]! * mask[pixel]!) / 255);
    }
  }
  return sharp(big, { raw: { width: bigWidth, height: bigHeight, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
}

async function make(placeholder: UiPlaceholder, board: () => Promise<Rgba>): Promise<Buffer> {
  if ('from' in placeholder) {
    return cutFromMoodboard(placeholder, await board());
  }
  if ('svg' in placeholder) {
    return sharp(Buffer.from(placeholder.svg)).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  }
  const { size } = placeholder;
  return sharp(Buffer.from(paintFill(placeholder.fill, size)), {
    raw: { width: size, height: size, channels: 4 },
  })
    .removeAlpha()
    .webp({ quality: 90 })
    .toBuffer();
}

const times = (sides: Sides | undefined, by: number): Sides | undefined =>
  sides === undefined ? undefined : [sides[0] * by, sides[1] * by, sides[2] * by, sides[3] * by];

/** A border placeholder's file, in the placeholder picture's own pixels, laid out to be read and edited. */
function borderFileOf(placeholder: UiPlaceholder, border: BorderFile): string {
  const by = 'from' in placeholder ? PAINTED_AT : 1;
  const file: Record<string, unknown> = { slice: times(border.slice, by) };
  if (border.repeat !== undefined) file.repeat = border.repeat;
  if (border.inset !== undefined) file.inset = times(border.inset, by);
  if (border.outset !== undefined) file.outset = times(border.outset, by);
  if (border.middle !== undefined) file.middle = border.middle;
  if (border.fillUnder !== undefined) file.fillUnder = times(border.fillUnder, by);
  return `${JSON.stringify(file, null, 2).replace(/\[\s+([^\]]*?)\s+\]/g, (_, inside: string) => `[${inside.replace(/\s+/g, ' ')}]`)}\n`;
}

async function placeholders(): Promise<void> {
  const known = readPlaceholders();
  let board: Rgba | null = null;
  const moodboard = async (): Promise<Rgba> => {
    if (board === null) {
      if (!existsSync(MOODBOARD)) {
        throw new Error('world/ui/moodboard.webp is missing, and the placeholders are cut from it');
      }
      board = await decode(readFileSync(MOODBOARD));
      if (board.width !== MOODBOARD_SIZE.width || board.height !== MOODBOARD_SIZE.height) {
        throw new Error(
          `world/ui/moodboard.webp is ${board.width}x${board.height}, and the placeholders are measured on the ` +
            `${MOODBOARD_SIZE.width}x${MOODBOARD_SIZE.height} one; cut nothing from a board they were not measured on`,
        );
      }
    }
    return board;
  };
  let made = 0;
  let kept = 0;
  for (const placeholder of UI_PLACEHOLDERS) {
    mkdirSync(resolve(UI_DIR, placeholder.kind), { recursive: true });
    const there = picturesIn(placeholder.kind);
    if (there.has(placeholder.name)) {
      kept += 1;
    } else {
      const bytes = await make(placeholder, moodboard);
      const file = `${placeholder.name}.webp`;
      writeFileSync(resolve(UI_DIR, placeholder.kind, file), bytes);
      known[`${placeholder.kind}/${file}`] = hashOf(bytes);
      made += 1;
      console.log(`made  ${placeholder.kind}/${file}`);
    }
    if (placeholder.kind === 'borders' && 'border' in placeholder && placeholder.border !== undefined) {
      const json = resolve(UI_DIR, placeholder.kind, `${placeholder.name}.json`);
      if (!existsSync(json)) {
        writeFileSync(json, borderFileOf(placeholder, placeholder.border));
        console.log(`made  ${placeholder.kind}/${placeholder.name}.json`);
      }
    }
  }
  writePlaceholders(known);
  console.log(`${made} placeholders made and ${kept} pictures kept, in ${UI_DIR}\n`);
}

// --- the cut ---------------------------------------------------------------------------------------

/**
 * Forgets the placeholders that are no longer in the folder: saved over, or deleted. Their records would
 * otherwise outlive them, which the folder's own test calls a broken folder.
 */
function forgetReplacedPlaceholders(): Record<string, string> {
  const known = readPlaceholders();
  const gone = Object.keys(known).filter((file) => {
    const path = resolve(UI_DIR, file);
    return !existsSync(path) || hashOf(readFileSync(path)) !== known[file];
  });
  if (gone.length > 0) {
    for (const file of gone) {
      delete known[file];
    }
    writePlaceholders(known);
    console.log(
      `forgot ${gone.length === 1 ? 'a placeholder' : `${gone.length} placeholders`} no longer in the folder: ${gone.join(', ')}`,
    );
  }
  return known;
}

/** What is kept of a cut besides its files, so that one read back from the cache says what it said. */
interface Remembered {
  readonly width: number;
  readonly height: number;
  readonly painted: { readonly width: number; readonly height: number };
  readonly how: string;
  readonly densities: readonly {
    readonly density: number;
    readonly width: number;
    readonly height: number;
  }[];
}

interface Cut {
  readonly picture: UiPicture;
  /** Each density's bytes, by the file name it is written under. */
  readonly files: ReadonlyMap<string, Buffer>;
  readonly fresh: boolean;
}

const kilobytes = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * One density of a fill, cut so that it still repeats: the fill laid three by three, shrunk, and its
 * middle taken, so that every pixel at an edge is shrunk from the fill's own far side rather than from
 * nothing, which is what would otherwise put a line round every tile.
 */
async function fillAt(image: Rgba, width: number, height: number): Promise<Buffer> {
  const around = await sharp({
    create: { width: image.width * 3, height: image.height * 3, channels: 4, background: '#000' },
  })
    .composite(
      [0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((column) => ({
          input: Buffer.from(image.data),
          raw: { width: image.width, height: image.height, channels: 4 as const },
          left: column * image.width,
          top: row * image.height,
        })),
      ),
    )
    .raw()
    .toBuffer();
  const shrunk = await sharp(around, {
    raw: { width: image.width * 3, height: image.height * 3, channels: 4 },
  })
    .resize(width * 3, height * 3, { kernel: 'lanczos3', fit: 'fill' })
    .raw()
    .toBuffer();
  return sharp(shrunk, { raw: { width: width * 3, height: height * 3, channels: 4 } })
    .extract({ left: width, top: height, width, height })
    .removeAlpha()
    .webp(WEBP)
    .toBuffer();
}

async function cutOne(kind: UiKind, name: string, file: string, known: Record<string, string>): Promise<Cut> {
  const source = `${kind}/${file}`;
  const bytes = readFileSync(resolve(UI_DIR, kind, file));
  const placeholder = known[source] === hashOf(bytes);
  const key = `${hashOf(bytes).slice(0, 24)}-${RULES}`;
  cutsUsed.add(key);

  let remembered: Remembered | null = null;
  const cached = new Map<number, Buffer>();
  const cachedCut = resolve(UI_CACHE_DIR, `${key}.json`);
  if (existsSync(cachedCut)) {
    remembered = JSON.parse(readFileSync(cachedCut, 'utf8')) as Remembered;
    for (const density of CUT_AT) {
      const at = resolve(UI_CACHE_DIR, `${key}@${density}x.webp`);
      if (existsSync(at)) {
        cached.set(density, readFileSync(at));
      }
    }
    if (cached.size !== CUT_AT.length) {
      remembered = null;
      cached.clear();
    }
  }

  const fresh = remembered === null;
  if (remembered === null) {
    let image = await decode(bytes);
    let how: string;
    if (kind === 'fills') {
      how = 'opaque, cut to repeat';
    } else if (hasOwnAlpha(image)) {
      how = 'its own alpha';
    } else {
      try {
        const keyed = keyOut(image);
        image = keyed.image;
        how = keyed.background === null ? 'its own alpha' : `keyed rgb(${keyed.background.join(',')})`;
      } catch (cause) {
        if (CUT_OUT.has(kind)) {
          throw new Error(
            `world/ui/${source} has to stand on nothing, and ${(cause as Error).message}: cut it out onto ` +
              'transparency, or save it on one flat colour',
            { cause },
          );
        }
        how = 'opaque';
      }
    }
    const width = asShown(image.width);
    const height = asShown(image.height);
    const densities = [];
    mkdirSync(UI_CACHE_DIR, { recursive: true });
    for (const density of CUT_AT) {
      const out =
        kind === 'fills'
          ? await fillAt(image, width * density, height * density)
          : await sharp(Buffer.from(image.data), {
              raw: { width: image.width, height: image.height, channels: 4 },
            })
              .resize(width * density, height * density, { kernel: 'lanczos3', fit: 'fill' })
              .webp(WEBP)
              .toBuffer();
      cached.set(density, out);
      writeFileSync(resolve(UI_CACHE_DIR, `${key}@${density}x.webp`), out);
      densities.push({ density, width: width * density, height: height * density });
    }
    remembered = { width, height, painted: { width: image.width, height: image.height }, how, densities };
    writeFileSync(cachedCut, JSON.stringify(remembered));
  }

  const files = new Map<string, Buffer>();
  const cuts: UiCut[] = remembered.densities.map(({ density, width, height }) => {
    const out = cached.get(density)!;
    const named = `${name}.${hashOf(out).slice(0, 10)}@${density}x.webp`;
    files.set(named, out);
    return { density, url: `/ui/${kind}/${named}`, width, height, bytes: out.length };
  });

  let border;
  if (kind === 'borders') {
    const json = resolve(UI_DIR, kind, `${name}.json`);
    if (!existsSync(json)) {
      throw new Error(
        `world/ui/${source} has no ${name}.json beside it, saying where its four cuts go: ` +
          '{ "slice": [top, right, bottom, left] } in the picture’s own pixels',
      );
    }
    border = borderAsShown(
      readBorderFile(readFileSync(json, 'utf8'), `world/ui/${kind}/${name}.json`),
      remembered,
      `world/ui/${kind}/${name}.json`,
    );
  }

  const about = placeholder ? placeholderAbout(kind, name) : undefined;
  const picture: UiPicture = {
    kind,
    name,
    source,
    placeholder,
    ...(about === undefined ? {} : { about }),
    width: remembered.width,
    height: remembered.height,
    painted: remembered.painted,
    how: remembered.how,
    cuts,
    ...(border === undefined ? {} : { border }),
  };
  return { picture, files, fresh };
}

/** Every file under a folder, relative to it, with forward slashes. */
function filesUnder(folder: string): string[] {
  if (!existsSync(folder)) {
    return [];
  }
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, resolve(entry.parentPath, entry.name)).split(sep).join('/'));
}

async function cut(): Promise<void> {
  const known = forgetReplacedPlaceholders();
  const strays = existsSync(UI_DIR)
    ? readdirSync(UI_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !(UI_KINDS as readonly string[]).includes(entry.name))
        .map((entry) => entry.name)
    : [];
  if (strays.length > 0) {
    throw new Error(
      `world/ui/ has folders that are no kind of picture: ${strays.join(', ')}; the kinds are ${UI_KINDS.join(', ')}`,
    );
  }

  const cuts: Cut[] = [];
  for (const kind of UI_KINDS) {
    for (const [name, file] of picturesIn(kind)) {
      const done = await cutOne(kind, name, file, known);
      cuts.push(done);
      const { picture } = done;
      console.log(
        `${picture.placeholder ? 'placeholder' : 'PICTURE    '} ${picture.source.padEnd(34)} ` +
          `${picture.painted.width}x${picture.painted.height} -> shown ${picture.width}x${picture.height}, ${picture.how}: ` +
          `${picture.cuts.map((one) => `${one.density}x ${kilobytes(one.bytes)}`).join(', ')}` +
          `${done.fresh ? '' : ', as cut before'}`,
      );
    }
  }

  const pictures = cuts.map((one) => one.picture);
  const version = hashOf(JSON.stringify(pictures)).slice(0, 16);
  const list: UiArtFile = { version, cutAt: new Date().toISOString(), paintedAt: PAINTED_AT, pictures };

  // Write what is missing, take away what nothing names, and the list last, so a page that reads the
  // list never finds it naming a file that is not there yet.
  const wanted = new Map<string, Buffer>();
  for (const one of cuts) {
    for (const [named, bytes] of one.files) {
      wanted.set(`${one.picture.kind}/${named}`, bytes);
    }
  }
  let written = 0;
  for (const [path, bytes] of wanted) {
    const at = resolve(UI_OUT_DIR, path);
    if (!existsSync(at)) {
      mkdirSync(resolve(at, '..'), { recursive: true });
      writeFileSync(at, bytes);
      written += 1;
    }
  }
  let removed = 0;
  for (const path of filesUnder(UI_OUT_DIR)) {
    if (path !== 'ui.json' && !wanted.has(path)) {
      rmSync(resolve(UI_OUT_DIR, path));
      removed += 1;
    }
  }
  const listFile = resolve(UI_OUT_DIR, 'ui.json');
  let before: string | null = null;
  try {
    before = (JSON.parse(readFileSync(listFile, 'utf8')) as UiArtFile).version;
  } catch {
    // Not there, or not readable: either way, not this one.
  }
  const changed = before !== version || written > 0 || removed > 0;
  if (changed) {
    mkdirSync(UI_OUT_DIR, { recursive: true });
    writeFileSync(listFile, `${JSON.stringify(list, null, 2)}\n`);
  }

  // Drop from the cache whatever this cut did not use, so it holds the folder and not its history.
  for (const file of existsSync(UI_CACHE_DIR) ? readdirSync(UI_CACHE_DIR) : []) {
    if (!cutsUsed.has(file.replace(/(@\dx\.webp|\.json)$/, ''))) {
      rmSync(resolve(UI_CACHE_DIR, file));
    }
  }

  const weight = weightAt(pictures, 2);
  const placeholderCount = pictures.filter((picture) => picture.placeholder).length;
  const fresh = cuts.filter((one) => one.fresh).map((one) => one.picture.source);
  const outcome = !changed
    ? 'nothing new'
    : fresh.length > 0
      ? `cut ${fresh.length === pictures.length ? 'everything' : fresh.join(', ')}`
      : 'the list changed';
  console.log(
    `\nui: ${pictures.length} pictures, ${placeholderCount} of them placeholders, ${megabytes(weight)} at 2x ` +
      `${weight > UI_BUDGET ? 'OVER' : 'of'} a ${megabytes(UI_BUDGET)} budget - ${outcome}`,
  );
}

try {
  if (makePlaceholders) {
    await placeholders();
  }
  await cut();
} catch (cause) {
  console.error(`world:ui failed: ${(cause as Error).message}`);
  process.exit(1);
}

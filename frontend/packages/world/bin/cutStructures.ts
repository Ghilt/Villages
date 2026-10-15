import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import sharp from 'sharp';

import { crop, opaqueBox, packShelves } from '../src/art.ts';
import type { Rgba } from '../src/art.ts';
import { flagOf, keyOfStructureFile, structurePictureFile } from '../src/structureArt.ts';
import type { StructureAtlasFile, StructureFrame } from '../src/structureArt.ts';
import {
  DRAWN_CULTURES,
  DRAWN_TYPES,
  RUIN_PICTURE,
  pictureFor,
  pictureSvg,
  styled,
} from '../src/structureLooks.ts';
import { keyOfStructureMarkFile, structureMarkFile, structureMarkSvg } from '../src/structureMarks.ts';

import { ART_DIR, STRUCTURE_MARKS_DIR, STRUCTURES_DIR } from './lib/paths.ts';

/**
 * The pictures of structures, one a type and a culture and a ruin a culture, cut into one atlas.
 *
 *   node bin/cutStructures.ts
 *
 * First it draws a placeholder for every picture `world/sprites/structures/` has none of, from the same shapes the
 * map draws in code, and remembers what it drew in `placeholders.json` there, so a picture saved over one is known to
 * be Adam's and is never drawn over. Then it crops every picture to what is drawn in it, scales it to one height,
 * finds where a pennant stands on it, and packs them all into `public/art/structures.webp` with `structures.json`
 * beside it, which the map draws from where it has a picture and draws in code where it has none. The marks of
 * `world/sprites/marks/structures/`, a pin a type and the ruin's, are drawn and cut the same way into the same atlas,
 * with a record of their own. Nothing is written
 * when nothing is new. Seconds. See docs/plans/structures.md.
 */

/** How tall every picture is cut, in pixels: the map lays a structure out 160 tall, as its castle is. */
const HEIGHT = 160;
/** How big a placeholder is drawn, before it is cropped and scaled. */
const DRAWN = 384;
const PAD = 2;
const WIDEST = 1024;

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** A folder of pictures, what a file in it is keyed by, and its record of which are still placeholders. */
interface Folder {
  dir: string;
  keyOf: (file: string) => string | null;
  record: string;
  placeholders: Record<string, string>;
}

async function folder(dir: string, keyOf: (file: string) => string | null): Promise<Folder> {
  await mkdir(dir, { recursive: true });
  const record = resolve(dir, 'placeholders.json');
  const placeholders = existsSync(record)
    ? (JSON.parse(await readFile(record, 'utf8')) as Record<string, string>)
    : {};
  return { dir, keyOf, record, placeholders };
}

const pictures = await folder(STRUCTURES_DIR, keyOfStructureFile);
const marks = await folder(STRUCTURE_MARKS_DIR, keyOfStructureMarkFile);

// Draw what is missing, never over a file that is there.
let drawn = 0;
async function drawMissing(into: Folder, file: string, svg: () => string): Promise<void> {
  const path = resolve(into.dir, file);
  if (existsSync(path)) return;
  const png = await sharp(Buffer.from(svg())).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path, png);
  into.placeholders[file] = sha(png);
  drawn += 1;
}
for (const picture of [...DRAWN_TYPES, RUIN_PICTURE]) {
  for (const culture of DRAWN_CULTURES) {
    await drawMissing(pictures, structurePictureFile(picture, culture), () =>
      pictureSvg(styled(pictureFor(picture, picture === RUIN_PICTURE), culture), DRAWN),
    );
  }
  await drawMissing(marks, structureMarkFile(picture), () => structureMarkSvg(picture, DRAWN));
}

// Cut every picture there is.
const pieces: { key: string; file: string; image: Rgba; placeholder: boolean }[] = [];
const files = async (from: Folder) =>
  (await readdir(from.dir))
    .filter((file) => from.keyOf(file) !== null)
    .sort()
    .map((file) => ({ from, file }));
for (const { from, file } of [...(await files(pictures)), ...(await files(marks))]) {
  const bytes = await readFile(resolve(from.dir, file));
  const placeholder = from.placeholders[file] === sha(bytes);
  if (!placeholder) delete from.placeholders[file];
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const whole: Rgba = { width: info.width, height: info.height, data: new Uint8Array(data) };
  const box = opaqueBox(whole);
  if (box === null) {
    console.log(`structures: ${file} has nothing drawn in it, so it is left out`);
    continue;
  }
  const cropped = crop(whole, box);
  const width = Math.max(1, Math.round((cropped.width * HEIGHT) / cropped.height));
  const scaled = await sharp(Buffer.from(cropped.data), {
    raw: { width: cropped.width, height: cropped.height, channels: 4 },
  })
    .resize(width, HEIGHT, { kernel: 'lanczos3' })
    .raw()
    .toBuffer();
  pieces.push({
    key: from.keyOf(file)!,
    file: from === marks ? `../marks/structures/${file}` : file,
    image: { width, height: HEIGHT, data: new Uint8Array(scaled) },
    placeholder,
  });
}

const packed = packShelves(
  pieces.map((piece) => ({ width: piece.image.width, height: piece.image.height })),
  PAD,
  WIDEST,
);
const atlas = await sharp({
  create: {
    width: packed.width,
    height: packed.height,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(
    pieces.map((piece, at) => ({
      input: Buffer.from(piece.image.data),
      raw: { width: piece.image.width, height: piece.image.height, channels: 4 as const },
      left: packed.placed[at]!.x,
      top: packed.placed[at]!.y,
    })),
  )
  .webp({ lossless: true, effort: 6 })
  .toBuffer();

const frames: Record<string, StructureFrame> = {};
pieces.forEach((piece, at) => {
  const flag = flagOf(piece.image);
  frames[piece.key] = {
    ...packed.placed[at]!,
    width: piece.image.width,
    height: piece.image.height,
    flagX: flag.x,
    flagY: flag.y,
    placeholder: piece.placeholder,
    source: piece.file,
  };
});
const version = sha(atlas).slice(0, 16);
const atlasJson = resolve(ART_DIR, 'structures.json');
const before = existsSync(atlasJson)
  ? (JSON.parse(await readFile(atlasJson, 'utf8')) as StructureAtlasFile)
  : null;

for (const { record, placeholders } of [pictures, marks]) {
  await writeFile(record, `${JSON.stringify(placeholders, null, 2)}\n`);
}
const painted = pieces.filter((piece) => !piece.placeholder).length;
const said = `${pieces.length} pictures, ${painted} painted and ${pieces.length - painted} placeholders`;
if (before?.version === version) {
  console.log(`structures: nothing new - ${said}`);
} else {
  await mkdir(ART_DIR, { recursive: true });
  await writeFile(resolve(ART_DIR, 'structures.webp'), atlas);
  const file: StructureAtlasFile = {
    version,
    cutAt: new Date().toISOString(),
    width: packed.width,
    height: packed.height,
    frames,
  };
  // Last, so that a page that finds the file finds the atlas it names.
  await writeFile(atlasJson, `${JSON.stringify(file, null, 2)}\n`);
  console.log(
    `structures: cut - ${said}, ${drawn} drawn just now, atlas ${packed.width} by ${packed.height}`,
  );
}

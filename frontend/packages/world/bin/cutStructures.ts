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

import { ART_DIR, STRUCTURES_DIR } from './lib/paths.ts';

/**
 * The pictures of structures, one a type and a culture and a ruin a culture, cut into one atlas.
 *
 *   node bin/cutStructures.ts
 *
 * First it draws a placeholder for every picture `world/structures/` has none of, from the same shapes the map draws
 * in code, and remembers what it drew in `placeholders.json`, so a picture saved over one is known to be Adam's and is
 * never drawn over. Then it crops every picture to what is drawn in it, scales it to one height, finds where a
 * pennant stands on it, and packs them all into `public/art/structures.webp` with `structures.json` beside it, which
 * the map draws from where it has a picture and draws in code where it has none. Nothing is written when nothing is
 * new. Seconds. See docs/plans/structures.md.
 */

/** How tall every picture is cut, in pixels: the map lays a structure out 160 tall, as its castle is. */
const HEIGHT = 160;
/** How big a placeholder is drawn, before it is cropped and scaled. */
const DRAWN = 384;
const PAD = 2;
const WIDEST = 1024;

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const placeholdersFile = resolve(STRUCTURES_DIR, 'placeholders.json');

await mkdir(STRUCTURES_DIR, { recursive: true });
const placeholders: Record<string, string> = existsSync(placeholdersFile)
  ? (JSON.parse(await readFile(placeholdersFile, 'utf8')) as Record<string, string>)
  : {};

// Draw what is missing, never over a file that is there.
let drawn = 0;
for (const culture of DRAWN_CULTURES) {
  for (const picture of [...DRAWN_TYPES, RUIN_PICTURE]) {
    const file = structurePictureFile(picture, culture);
    const path = resolve(STRUCTURES_DIR, file);
    if (existsSync(path)) continue;
    const svg = pictureSvg(styled(pictureFor(picture, picture === RUIN_PICTURE), culture), DRAWN);
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(path, png);
    placeholders[file] = sha(png);
    drawn += 1;
  }
}

// Cut every picture there is.
const files = (await readdir(STRUCTURES_DIR)).filter((file) => keyOfStructureFile(file) !== null).sort();
const pieces: { key: string; file: string; image: Rgba; placeholder: boolean }[] = [];
for (const file of files) {
  const bytes = await readFile(resolve(STRUCTURES_DIR, file));
  const placeholder = placeholders[file] === sha(bytes);
  if (!placeholder) delete placeholders[file];
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
    key: keyOfStructureFile(file)!,
    file,
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

await writeFile(placeholdersFile, `${JSON.stringify(placeholders, null, 2)}\n`);
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

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

import sharp from 'sharp';

import { crop, keyOut, packShelves } from '../src/art.ts';
import type { Rgba } from '../src/art.ts';
import { commonBox, critterFrameKey, critterKindsOf, framesOf } from '../src/critterArt.ts';
import type { CritterAtlasFile, CritterCut, CritterFile, CritterFrame } from '../src/critterArt.ts';
import { critterPlaceholderSvg } from '../src/critterPlaceholders.ts';

import { ART_DIR, CRITTERS, CRITTERS_DIR } from './lib/paths.ts';

/**
 * The critters' pictures, one a kind in `world/sprites/critters/`, its frames side by side, cut into one atlas.
 *
 *   node bin/cutCritters.ts
 *
 * First it draws a placeholder strip for every kind `world/critters.json` lists that has no picture, and remembers
 * what it drew in `placeholders.json` there, so a picture saved over one is known to be Adam's and is never drawn
 * over. Then it takes each picture's background away - its own transparency, or the flat colour around its edge -
 * cuts it into its frames, crops every frame of a kind to the one box that holds all of them, so the frames register,
 * scales them to one height, and packs them into `public/art/critters.webp` with `critters.json` beside it. A picture
 * it cannot cut is said and left out, and the others are cut. Nothing is written when nothing is new. Seconds.
 * See docs/plans/living-world.md and docs/AUTHORING-THE-ART.md.
 */

/**
 * How tall every frame is cut, in pixels: twice the tallest a critter is drawn, about thirty pixels at the closest
 * zoom, so it holds on a display at 200 per cent, with the browser's mipmaps for the smaller sizes.
 */
const HEIGHT = 64;
const PAD = 2;
const WIDEST = 1024;
const PICTURES = new Set(['.png', '.webp', '.jpg', '.jpeg']);

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const kinds = critterKindsOf(JSON.parse(await readFile(CRITTERS, 'utf8')) as CritterFile);
await mkdir(CRITTERS_DIR, { recursive: true });
const record = resolve(CRITTERS_DIR, 'placeholders.json');
const placeholders = existsSync(record)
  ? (JSON.parse(await readFile(record, 'utf8')) as Record<string, string>)
  : {};

/** The pictures in the folder by the kind they are of, refusing two files that would both be the same kind. */
async function picturesThere(): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const file of (await readdir(CRITTERS_DIR)).sort()) {
    const extension = extname(file).toLowerCase();
    if (!PICTURES.has(extension)) continue;
    const name = file.slice(0, -extension.length);
    const already = found.get(name);
    if (already !== undefined) {
      throw new Error(`critters/${already} and critters/${file} are both ${name}; keep one of them`);
    }
    found.set(name, file);
  }
  return found;
}

// Draw what is missing, never over a file that is there.
let drawn = 0;
for (const kind of kinds) {
  if ((await picturesThere()).has(kind.name)) continue;
  const png = await sharp(Buffer.from(critterPlaceholderSvg(kind.name, kind.frames)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(CRITTERS_DIR, `${kind.name}.png`), png);
  placeholders[`${kind.name}.png`] = sha(png);
  drawn += 1;
}

// Cut every kind there is a picture of.
const there = await picturesThere();
const pieces: { key: string; image: Rgba }[] = [];
const cuts: Record<string, CritterCut> = {};
const left: string[] = [];
for (const kind of kinds) {
  const file = there.get(kind.name)!;
  const bytes = await readFile(resolve(CRITTERS_DIR, file));
  const placeholder = placeholders[file] === sha(bytes);
  try {
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const strip = keyOut({ width: info.width, height: info.height, data: new Uint8Array(data) }).image;
    const frames = framesOf(strip, kind.frames);
    const box = commonBox(frames);
    if (box === null) throw new Error('nothing is drawn in it once its background is taken away');
    const width = Math.max(1, Math.round((box.width * HEIGHT) / box.height));
    const keys: string[] = [];
    for (const [at, frame] of frames.entries()) {
      const cropped = crop(frame, box);
      const scaled = await sharp(Buffer.from(cropped.data), {
        raw: { width: cropped.width, height: cropped.height, channels: 4 },
      })
        .resize(width, HEIGHT, { kernel: 'lanczos3', fit: 'fill' })
        .raw()
        .toBuffer();
      keys.push(critterFrameKey(kind.name, at));
      pieces.push({ key: keys.at(-1)!, image: { width, height: HEIGHT, data: new Uint8Array(scaled) } });
    }
    // It stands on the bottom of its box, in the middle: the motion is the code's, the pose is the picture's.
    cuts[kind.name] = { frames: keys, footX: width / 2, footY: HEIGHT, placeholder, source: file };
  } catch (cause) {
    left.push(`${file}: ${(cause as Error).message}`);
  }
}
for (const file of Object.keys(placeholders)) {
  // A placeholder painted over, or a picture of a kind no longer listed and deleted, is forgotten.
  const path = resolve(CRITTERS_DIR, file);
  if (!existsSync(path) || sha(await readFile(path)) !== placeholders[file]) delete placeholders[file];
}
await writeFile(record, `${JSON.stringify(placeholders, null, 2)}\n`);

const packed = packShelves(
  pieces.map((piece) => ({ width: piece.image.width, height: piece.image.height })),
  PAD,
  WIDEST,
);
const atlas = await sharp({
  create: {
    width: Math.max(1, packed.width),
    height: Math.max(1, packed.height),
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

const frames: Record<string, CritterFrame> = {};
pieces.forEach((piece, at) => {
  const kind = piece.key.split('/')[0]!;
  frames[piece.key] = {
    ...packed.placed[at]!,
    width: piece.image.width,
    height: piece.image.height,
    placeholder: cuts[kind]!.placeholder,
    source: cuts[kind]!.source,
  };
});
const version = sha(Buffer.concat([atlas, Buffer.from(JSON.stringify(cuts))])).slice(0, 16);
const atlasJson = resolve(ART_DIR, 'critters.json');
const before = existsSync(atlasJson)
  ? (JSON.parse(await readFile(atlasJson, 'utf8')) as CritterAtlasFile)
  : null;

const cutKinds = Object.values(cuts);
const painted = cutKinds.filter((cut) => !cut.placeholder).length;
const said =
  `${cutKinds.length} kinds in ${pieces.length} frames, ${painted} painted and ` +
  `${cutKinds.length - painted} placeholders`;
for (const why of left) console.log(`critters: left out ${why}`);
const extra = [...there.keys()].filter((name) => !kinds.some((kind) => kind.name === name));
if (extra.length > 0)
  console.log(`critters: not a kind in world/critters.json, so not cut: ${extra.join(', ')}`);
if (before?.version === version) {
  console.log(`critters: nothing new - ${said}`);
} else {
  await mkdir(ART_DIR, { recursive: true });
  await writeFile(resolve(ART_DIR, 'critters.webp'), atlas);
  const file: CritterAtlasFile = {
    version,
    cutAt: new Date().toISOString(),
    width: packed.width,
    height: packed.height,
    frames,
    kinds: cuts,
  };
  // Last, so that a page that finds the file finds the atlas it names.
  await writeFile(atlasJson, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`critters: cut - ${said}, ${drawn} drawn just now, atlas ${packed.width} by ${packed.height}`);
}

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

import { crop, opaqueBox, packShelves } from '../../src/art.ts';
import type { Rgba } from '../../src/art.ts';
import { flagOf, footOfBridge, footOfBuilding, shadowOfBuilding } from '../../src/structureArt.ts';
import type { StructureAtlasFile, StructureFrame, StructureShadow } from '../../src/structureArt.ts';

/*
 * Cutting pictures of buildings into an atlas: what `world:structures` does for the structures and for the pieces of
 * the settlements and the bridges, each into an atlas of its own. A folder of pictures keeps a record of which are still
 * placeholders drawn in code, so a picture saved over one is known to be Adam's and is never drawn over; every picture
 * is cropped to what is drawn in it, scaled, measured for where it stands and where a pennant would, given its shadow,
 * and packed. Nothing is written when nothing is new. See docs/plans/structures.md and docs/plans/settlements-and-roads.md.
 */

const PAD = 2;
/** Twice the scenery's, because the buildings' shadows are packed in too: kept nearer square than tall. */
const WIDEST = 2048;

export const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** A folder of pictures, what a file in it is keyed by, and its record of which are still placeholders. */
export interface Folder {
  dir: string;
  keyOf: (file: string) => string | null;
  record: string;
  placeholders: Record<string, string>;
}

export async function folderOf(dir: string, keyOf: (file: string) => string | null): Promise<Folder> {
  await mkdir(dir, { recursive: true });
  const record = resolve(dir, 'placeholders.json');
  const placeholders = existsSync(record)
    ? (JSON.parse(await readFile(record, 'utf8')) as Record<string, string>)
    : {};
  return { dir, keyOf, record, placeholders };
}

/** Draws a placeholder where a folder has no such file, never over one that is there; says whether it drew it. */
export async function drawMissing(into: Folder, file: string, svg: () => string): Promise<boolean> {
  const path = resolve(into.dir, file);
  if (existsSync(path)) return false;
  const png = await sharp(Buffer.from(svg())).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path, png);
  into.placeholders[file] = sha(png);
  return true;
}

/**
 * Draws a placeholder from a picture made `fine` times larger than it is kept, where a folder has no such file, never over
 * one that is there; says whether it drew it.
 */
export async function drawMissingPicture(
  into: Folder,
  file: string,
  picture: () => Rgba,
  fine: number,
): Promise<boolean> {
  const path = resolve(into.dir, file);
  if (existsSync(path)) return false;
  const { width, height, data } = picture();
  const png = await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
    .resize(Math.round(width / fine), Math.round(height / fine), { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path, png);
  into.placeholders[file] = sha(png);
  return true;
}

/** Every picture a folder holds, by its name, in order. */
export async function picturesIn(from: Folder): Promise<{ from: Folder; file: string }[]> {
  return (await readdir(from.dir))
    .filter((file) => from.keyOf(file) !== null)
    .sort()
    .map((file) => ({ from, file }));
}

/** How the pictures are scaled: all to one height in pixels, or each by how many world units it stands. */
export type Sizing =
  { readonly tall: number } | { readonly drawnPerUnit: number; readonly cutPerUnit: number };

/** A picture to cut: from where, under what key, and where on it it stands. */
export interface ToCut {
  readonly from: Folder;
  readonly file: string;
  /** What the frame names as its source, from the atlas's folder of pictures. */
  readonly source: string;
  /** A sign rather than a building, which casts no shadow. */
  readonly pin: boolean;
  /**
   * A building stands on the front corner of its base; a jetty on the middle of its deck, halfway between where its ends
   * are lowest; the bridge on the middle of its picture, where its deck's middle is drawn on the ground.
   */
  readonly stands: 'corner' | 'middle' | 'centre';
}

/**
 * Cuts the pictures into the atlas `name` in `dir`, `<name>.webp` and `<name>.json`, and says what it did. Every
 * building's shadow is cut from its picture into the same atlas; a sign and a bridge cast none here.
 */
export async function cutAtlas(
  pictures: readonly ToCut[],
  sizing: Sizing,
  dir: string,
  name: string,
): Promise<string> {
  const pieces: {
    key: string;
    source: string;
    image: Rgba;
    footX: number;
    footY: number | null;
    tall: number | null;
    placeholder: boolean;
    shadow: boolean;
  }[] = [];
  for (const { from, file, source, pin, stands } of pictures) {
    const bytes = await readFile(resolve(from.dir, file));
    const placeholder = from.placeholders[file] === sha(bytes);
    if (!placeholder) delete from.placeholders[file];
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const whole: Rgba = { width: info.width, height: info.height, data: new Uint8Array(data) };
    const box = opaqueBox(whole);
    if (box === null) {
      console.log(`${name}: ${file} has nothing drawn in it, so it is left out`);
      continue;
    }
    const cropped = crop(whole, box);
    const height =
      'tall' in sizing
        ? sizing.tall
        : Math.max(1, Math.round((cropped.height * sizing.cutPerUnit) / sizing.drawnPerUnit));
    const width = Math.max(1, Math.round((cropped.width * height) / cropped.height));
    const scaled = await sharp(Buffer.from(cropped.data), {
      raw: { width: cropped.width, height: cropped.height, channels: 4 },
    })
      .resize(width, height, { kernel: 'lanczos3' })
      .raw()
      .toBuffer();
    // Read before the picture is scaled down, where the corner is still sharp.
    const foot =
      stands === 'corner'
        ? { x: footOfBuilding(cropped), y: null }
        : stands === 'centre'
          ? { x: (whole.width / 2 - box.x) / box.width, y: (whole.height / 2 - box.y) / box.height }
          : footOfBridge(cropped);
    pieces.push({
      key: from.keyOf(file)!,
      source,
      image: { width, height, data: new Uint8Array(scaled) },
      footX: foot.x,
      footY: foot.y,
      tall: 'tall' in sizing ? null : cropped.height / sizing.drawnPerUnit,
      placeholder,
      shadow: !pin && stands === 'corner',
    });
  }

  const shadows = pieces.map((piece) =>
    piece.shadow ? shadowOfBuilding(piece.image, piece.footX * piece.image.width) : null,
  );
  // The pictures first and the shadows after them, so a picture's place in the atlas is its place in `pieces`.
  const images = [
    ...pieces.map((piece) => piece.image),
    ...shadows.flatMap((shadow) => (shadow === null ? [] : [shadow.image])),
  ];
  const packed = packShelves(
    images.map((image) => ({ width: image.width, height: image.height })),
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
      images.map((image, at) => ({
        input: Buffer.from(image.data),
        raw: { width: image.width, height: image.height, channels: 4 as const },
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
      footX: piece.footX,
      ...(piece.footY === null ? {} : { footY: piece.footY }),
      ...(piece.tall === null ? {} : { tall: Math.round(piece.tall * 1000) / 1000 }),
      placeholder: piece.placeholder,
      source: piece.source,
    };
  });
  const shadowFrames: Record<string, StructureShadow> = {};
  let castAt = pieces.length;
  pieces.forEach((piece, at) => {
    const shadow = shadows[at];
    if (shadow === null || shadow === undefined) return;
    shadowFrames[piece.key] = {
      ...packed.placed[castAt]!,
      width: shadow.image.width,
      height: shadow.image.height,
      footX: Math.round(shadow.footX * 100) / 100,
      footY: shadow.footY,
    };
    castAt += 1;
  });
  // Of the frames too, so a change in what is measured on a picture is written when the pictures are not.
  const version = sha(
    Buffer.concat([atlas, Buffer.from(JSON.stringify({ frames, shadows: shadowFrames }))]),
  ).slice(0, 16);
  const json = resolve(dir, `${name}.json`);
  const before = existsSync(json) ? (JSON.parse(await readFile(json, 'utf8')) as StructureAtlasFile) : null;
  const painted = pieces.filter((piece) => !piece.placeholder).length;
  const said = `${pieces.length} pictures, ${painted} painted and ${pieces.length - painted} placeholders`;
  if (before?.version === version) {
    return `${name}: nothing new - ${said}`;
  }
  await mkdir(dirname(json), { recursive: true });
  await writeFile(resolve(dir, `${name}.webp`), atlas);
  const file: StructureAtlasFile = {
    version,
    cutAt: new Date().toISOString(),
    width: packed.width,
    height: packed.height,
    frames,
    shadows: shadowFrames,
  };
  // Last, so that a page that finds the file finds the atlas it names.
  await writeFile(json, `${JSON.stringify(file, null, 2)}\n`);
  return `${name}: cut - ${said}, atlas ${packed.width} by ${packed.height}`;
}

/** Writes each folder's record of which of its pictures are still placeholders. */
export async function savePlaceholders(folders: readonly Folder[]): Promise<void> {
  for (const { record, placeholders } of folders) {
    await writeFile(record, `${JSON.stringify(placeholders, null, 2)}\n`);
  }
}

import { SHADOW, blurRow } from './art.ts';
import type { Rgba } from './art.ts';
import { CULTURES } from './structures.ts';
import type { Culture } from './structures.ts';
import { RUIN_PICTURE, pictureKey } from './structureLooks.ts';

/*
 * The pictures of structures as files and as an atlas: a picture a type and a culture in `world/sprites/structures/`,
 * named `<type>-<culture>.png` and `ruin-<culture>.png`, which `world:structures` cuts into one atlas beside the
 * scenery's, keyed as the map asks for a picture, `mill@islamic`. Placeholders drawn from the shapes until Adam paints
 * over them. See docs/plans/structures.md.
 */

/** One picture in the atlas, and where on it a pennant's staff stands, as fractions of its width and height. */
export interface StructureFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  flagX: number;
  flagY: number;
  /** Where it stands on the ground across its width, as a fraction from the left: the front corner of its base. */
  footX: number;
  /** Still the placeholder drawn for it, not a picture painted over it. */
  placeholder: boolean;
  /** The file it was cut from, under `world/sprites/structures/`. */
  source: string;
}

/** A building's shadow in the atlas, and where its foot falls in it, in the shadow's own pixels from its top left. */
export interface StructureShadow {
  x: number;
  y: number;
  width: number;
  height: number;
  footX: number;
  footY: number;
}

/** `structures.json` beside the atlas. */
export interface StructureAtlasFile {
  /** A hash of the atlas's bytes, so a page asks again for a picture cut again. */
  version: string;
  cutAt: string;
  width: number;
  height: number;
  frames: Record<string, StructureFrame>;
  /**
   * Each building's shadow, by the same key, cut from its picture by `shadowOfBuilding` into the same atlas. A pin
   * casts none. Absent from an atlas cut before buildings had shadows.
   */
  shadows?: Record<string, StructureShadow>;
}

/** The file a picture of a type, or a ruin, in a culture is saved as. */
export function structurePictureFile(picture: string, culture: Culture): string {
  return `${picture === RUIN_PICTURE ? 'ruin' : picture}-${culture}.png`;
}

/** The name the map asks for the picture in a file by, or null for a file that is not one. */
export function keyOfStructureFile(file: string): string | null {
  const match = /^([a-z][a-zA-Z]*)-([a-zA-Z]+)\.png$/.exec(file);
  if (match === null || !CULTURES.includes(match[2] as Culture)) return null;
  return pictureKey(match[1] === 'ruin' ? RUIN_PICTURE : match[1]!, match[2] as Culture);
}

/**
 * Where a pennant stands on a picture: the middle of the highest row anything is drawn in, so it flies from what is
 * tallest, painted or drawn. As fractions of the picture's width and height; the top middle for a picture of nothing.
 */
export function flagOf(image: Rgba): { x: number; y: number } {
  for (let y = 0; y < image.height; y += 1) {
    let sum = 0;
    let count = 0;
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3]! > 127) {
        sum += x;
        count += 1;
      }
    }
    if (count > 0) return { x: (sum / count + 0.5) / image.width, y: y / image.height };
  }
  return { x: 0.5, y: 0 };
}

/** How many of a building's lowest rows its foot is read from. */
const BASE_ROWS = 2;

/**
 * Where a building stands across its picture, as a fraction of its width from the left: the front corner of its base.
 *
 * A building is painted turned to sit on the ground's diamonds, so its base is one, and the corner nearest the eye is
 * the lowest thing drawn. It is not the middle: the turn of twenty-six degrees puts it about a sixth of the base's
 * width right of it. Read as a tree's foot is, the lowest rows' middle weighted by how solid each pixel is, but from
 * its lowest two rows alone, because a tree's band would take in the long front edge running off to the left and walk
 * the foot with it. Faint pixels are passed over, so a soft painted edge under the corner does not count as the ground. The middle,
 * for a picture of nothing. See docs/plans/worked-ground.md.
 */
export function footOfBuilding(image: Rgba): number {
  const solid = (x: number, y: number) => image.data[(y * image.width + x) * 4 + 3]! > 127;
  let bottom = image.height - 1;
  while (bottom >= 0 && !Array.from({ length: image.width }, (_, x) => solid(x, bottom)).some(Boolean)) {
    bottom -= 1;
  }
  if (bottom < 0) return 0.5;
  let weight = 0;
  let sum = 0;
  for (let y = Math.max(0, bottom - BASE_ROWS + 1); y <= bottom; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (solid(x, y)) {
        const alpha = image.data[(y * image.width + x) * 4 + 3]!;
        weight += alpha;
        sum += alpha * (x + 0.5);
      }
    }
  }
  return sum / weight / image.width;
}

/** A whole image blurred, along its rows and then down its columns, twice over each. */
function blurred(shade: Float32Array, width: number, height: number, radius: number): Float32Array {
  const out = new Float32Array(shade);
  const row = new Float32Array(width);
  for (let y = 0; y < height; y += 1) {
    row.set(out.subarray(y * width, (y + 1) * width));
    blurRow(row, radius, 2);
    out.set(row, y * width);
  }
  const column = new Float32Array(height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) column[y] = out[y * width + x]!;
    blurRow(column, radius, 2);
    for (let y = 0; y < height; y += 1) out[y * width + x] = column[y]!;
  }
  return out;
}

/**
 * A building's shadow: its picture laid on the ground by the one light that lays every sprite's, black with the shade's
 * alpha, and where its foot falls in it.
 *
 * A tree stands on one point, so `shadowOf` lays every row of it from the bottom of its picture. A building stands on a
 * diamond, whose front edges run up to either side of its foot, and laid from its bottom row it would cast a band
 * under its whole width, as a thing floating over the ground does. So here each column of the picture stands on the
 * ground at its own lowest pixel, which is the front edge of its base, and every pixel above it is laid as far to the
 * left and towards the eye as it stands above that, `SHADOW.lean` and `SHADOW.flat` times, lighter the farther it
 * falls. Where two land on one spot the ground takes the darker. Softened from `SHADOW.soft[0]` near where it is cast
 * to `soft[1]` far out. The shade cast right at the front edge, where each column meets the ground, is what stands it
 * there, so a building needs no pool. What falls behind its walls the building is drawn over. See
 * docs/plans/worked-ground.md.
 */
export function shadowOfBuilding(image: Rgba, footX: number): { image: Rgba; footX: number; footY: number } {
  const { width, height, data } = image;
  const empty = { image: { width: 1, height: 1, data: new Uint8Array(4) }, footX: 0, footY: 0 };
  const margin = 2 * SHADOW.soft[1] + SHADOW.pad;
  const reach = Math.ceil(height * SHADOW.lean);
  const out = {
    width: width + reach + 2 * margin,
    height: height + Math.ceil(height * SHADOW.flat) + 2 * margin,
  };
  const originX = reach + margin;
  const originY = margin;
  const shade = new Float32Array(out.width * out.height);
  /** How far out each spot's darkest shade fell, by its shade, so the softening can follow it. */
  const along = new Float32Array(out.width * out.height);
  let any = false;
  for (let x = 0; x < width; x += 1) {
    let ground = height - 1;
    while (ground >= 0 && data[(ground * width + x) * 4 + 3]! === 0) ground -= 1;
    if (ground < 0) continue;
    const foot = ground + 1;
    // Half a pixel of height a step, so a column's line of shade has no gaps in it.
    for (let up = 0; up < foot * 2; up += 1) {
      const y = foot - 1 - Math.floor(up / 2);
      const alpha = data[(y * width + x) * 4 + 3]! / 255;
      if (alpha === 0) continue;
      const tall = (up + 0.5) / 2;
      const far = tall / height;
      const dark = alpha * (1 - SHADOW.fade * far);
      const atX = Math.round(originX + x + 0.5 - SHADOW.lean * tall - 0.5);
      const atY = Math.round(originY + foot + SHADOW.flat * tall - 0.5);
      const at = atY * out.width + atX;
      if (dark > shade[at]!) {
        shade[at] = dark;
        along[at] = far;
        any = true;
      }
    }
  }
  if (!any) return empty;

  // Soft near where it is cast and softer far out: the two softenings mixed by how far out each spot's shade fell.
  const near = blurred(shade, out.width, out.height, SHADOW.soft[0]);
  const wide = blurred(shade, out.width, out.height, SHADOW.soft[1]);
  const weighted = blurred(
    shade.map((value, at) => value * along[at]!),
    out.width,
    out.height,
    SHADOW.soft[1],
  );
  const mixed = near.map((value, at) => {
    const share = wide[at]! > 1e-4 ? Math.min(1, weighted[at]! / wide[at]!) : 1;
    return value * (1 - share) + wide[at]! * share;
  });

  // Trimmed to what is in it, with a little room around, so the atlas carries no empty margin.
  let left = out.width;
  let top = out.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      if (mixed[y * out.width + x]! >= 1 / 255) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  left = Math.max(0, left - SHADOW.pad);
  top = Math.max(0, top - SHADOW.pad);
  right = Math.min(out.width - 1, right + SHADOW.pad);
  bottom = Math.min(out.height - 1, bottom + SHADOW.pad);
  const trimmed = { width: right - left + 1, height: bottom - top + 1 };
  const pixels = new Uint8Array(trimmed.width * trimmed.height * 4);
  for (let y = 0; y < trimmed.height; y += 1) {
    for (let x = 0; x < trimmed.width; x += 1) {
      const alpha = mixed[(y + top) * out.width + (x + left)]!;
      pixels[(y * trimmed.width + x) * 4 + 3] = Math.max(0, Math.min(255, Math.round(alpha * 255)));
    }
  }
  return {
    image: { width: trimmed.width, height: trimmed.height, data: pixels },
    footX: originX + footX - left,
    footY: originY + height - top,
  };
}

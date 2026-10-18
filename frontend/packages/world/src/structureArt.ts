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

/** `structures.json` beside the atlas. */
export interface StructureAtlasFile {
  /** A hash of the atlas's bytes, so a page asks again for a picture cut again. */
  version: string;
  cutAt: string;
  width: number;
  height: number;
  frames: Record<string, StructureFrame>;
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

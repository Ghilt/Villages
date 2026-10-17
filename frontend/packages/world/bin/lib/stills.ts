import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { toRgb } from '../../src/palette.ts';
import type { Palette, Rgb } from '../../src/palette.ts';
import type { RuinPiece } from '../../src/ruinLayout.ts';
import type { RuinPieceSpec } from '../../src/ruins.ts';
import type { ScatteredPoint } from '../../src/scatter.ts';
import { NO_STANDS, decodeStands } from '../../src/stands.ts';
import type { StandChunk } from '../../src/stands.ts';

/**
 * What the two still painters share beyond the master: `renderPainterly.ts`, which paints the views in every
 * style, and `renderScenery.ts`, which paints the scenery's marks onto them. Their flat views are the same
 * flat, so that a style and the scenery are both compared against one baseline. And how the scenery's still
 * reads a layer's stands off the disk and stamps a mark for a tree and for a ruin.
 */

export const RADIANS = Math.PI / 180;

/**
 * Web Mercator's vertical coordinate, running to plus or minus pi. World space is a scaling of it.
 *
 * `toWorld` in `src/sphere.ts` works the same sum in another order, which differs from this one in the last
 * bit at some latitudes: making the stills use it moves a pixel here and there in them, and nothing on the map.
 */
export function mercatorY(latitude: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latitude * RADIANS) / 2));
}

/** The flat look, for the comparison: the colour each class is drawn in, by its id, and nothing else. */
export function flatColoursOf(palette: Palette, colours: Record<string, string>): Rgb[] {
  const flat: Rgb[] = [];
  for (let id = 0; id <= Math.max(...palette.classes.map((terrain) => terrain.id)); id += 1) {
    const terrain = palette.classes.find((candidate) => candidate.id === id);
    flat.push(toRgb(terrain === undefined ? '#000000' : colours[terrain.name]!));
  }
  return flat;
}

/**
 * A layer's stands off the disk, a tile at a time, each read once and kept. Most tiles have no file at all, which is
 * not a failure: they have no stands. Longitude wraps, as the world does.
 */
export function standsReader(
  standsDir: string,
  side: number,
  tileUnits: number,
): (tileX: number, tileY: number) => StandChunk {
  const across = side / tileUnits;
  const chunks = new Map<string, StandChunk>();
  return (tileX, tileY) => {
    if (tileY < 0 || tileY >= across) {
      return NO_STANDS;
    }
    const wrapped = ((tileX % across) + across) % across;
    const key = `${wrapped}/${tileY}`;
    const held = chunks.get(key);
    if (held !== undefined) {
      return held;
    }
    let chunk: StandChunk;
    try {
      const bytes = readFileSync(resolve(standsDir, String(wrapped), `${tileY}.bin`));
      chunk = decodeStands(
        new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        wrapped,
        tileY,
        tileUnits,
      );
    } catch {
      chunk = NO_STANDS;
    }
    chunks.set(key, chunk);
    return chunk;
  };
}

/** An image being stamped on: its pixels, three bytes each, and its size. */
export interface Canvas {
  readonly pixels: Uint8Array;
  readonly width: number;
  readonly height: number;
}

function blendInto(canvas: Canvas, x: number, y: number, ink: Rgb, mix: number): void {
  if (mix <= 0 || x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }
  const at = (y * canvas.width + x) * 3;
  const { pixels } = canvas;
  pixels[at] = Math.round(pixels[at]! * (1 - mix) + ink[0] * mix);
  pixels[at + 1] = Math.round(pixels[at + 1]! * (1 - mix) + ink[1] * mix);
  pixels[at + 2] = Math.round(pixels[at + 2]! * (1 - mix) + ink[2] * mix);
}

/**
 * What one tree is drawn as: a blob for its crown and a stroke for its stem, both in world units.
 *
 * Sized off `groundHeight` exactly as the sprite is, so the picture is to scale with the map even
 * though the shape is not the map's shape. Taller things are drawn darker, which is the one thing that
 * lets a mixed wood be read as mixed without a legend nobody wants on a still.
 */
const CROWN = 0.34;
const STEM = 0.4;

export function stamp(
  canvas: Canvas,
  atX: number,
  atY: number,
  point: ScatteredPoint,
  tallest: number,
  perPixel: number,
): void {
  const tall = point.height / perPixel;
  const radius = Math.max(0.6, tall * CROWN);
  // Nought for the floor, one for the canopy: the darker a mark is, the bigger the thing it stands for.
  const weight = tallest === 0 ? 1 : Math.min(1, point.height / tallest);
  const ink: Rgb = [
    Math.round(96 - 56 * weight),
    Math.round(112 - 58 * weight),
    Math.round(80 - 44 * weight),
  ];
  const alpha = 0.55 + 0.3 * weight;

  // The stem first, so the crown sits on top of it.
  const foot = atY + tall * STEM;
  for (let y = Math.floor(atY); y <= Math.ceil(foot); y += 1) {
    blendInto(canvas, Math.round(atX), y, ink, 0.8 * alpha);
  }

  const from = Math.floor(atX - radius - 1);
  const to = Math.ceil(atX + radius + 1);
  const top = Math.floor(atY - radius - 1);
  const bottom = Math.ceil(atY + radius + 1);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = from; x <= to; x += 1) {
      const dx = x + 0.5 - atX;
      const dy = y + 0.5 - atY;
      blendInto(canvas, x, y, ink, Math.min(1, radius + 0.5 - Math.sqrt(dx * dx + dy * dy)) * alpha);
    }
  }
}

/** The stone each culture builds in, on a still: grey, sand, a red-brown and ochre, in the order of `CULTURES`. */
const STONE: readonly Rgb[] = [
  [168, 164, 156],
  [206, 184, 140],
  [160, 104, 84],
  [196, 150, 92],
];

/**
 * What one piece of a ruin is drawn as on a still: its footprint, as wide as the piece and half as deep, in its
 * culture's stone, a taller piece darker and edged, so a hall reads from a row of houses and a wall from rubble.
 */
export function stampRuin(
  canvas: Canvas,
  atX: number,
  atY: number,
  piece: RuinPiece,
  spec: RuinPieceSpec,
  tallest: number,
  perPixel: number,
): void {
  const halfWide = Math.max(0.8, spec.width / 2 / perPixel);
  const halfDeep = Math.max(0.8, spec.width / 4 / perPixel);
  const weight = Math.min(1, piece.height / tallest);
  const stone = STONE[piece.culture] ?? STONE[0]!;
  const ink: Rgb = [
    Math.round(stone[0] * (1 - 0.45 * weight)),
    Math.round(stone[1] * (1 - 0.45 * weight)),
    Math.round(stone[2] * (1 - 0.45 * weight)),
  ];
  const edge: Rgb = [Math.round(ink[0] * 0.45), Math.round(ink[1] * 0.45), Math.round(ink[2] * 0.45)];
  for (let y = Math.floor(atY - halfDeep); y <= Math.ceil(atY + halfDeep); y += 1) {
    for (let x = Math.floor(atX - halfWide); x <= Math.ceil(atX + halfWide); x += 1) {
      const onEdge =
        x <= Math.floor(atX - halfWide) ||
        x >= Math.ceil(atX + halfWide) ||
        y <= Math.floor(atY - halfDeep) ||
        y >= Math.ceil(atY + halfDeep);
      blendInto(canvas, x, y, onEdge ? edge : ink, 0.9);
    }
  }
}

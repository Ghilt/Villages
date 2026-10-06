import { ORIGIN_CLONE, ORIGIN_EARTH, ORIGIN_INVENTED } from './originFile.ts';
import type { OriginGrid } from './originFile.ts';
import type { RgbImage } from './png.ts';
import type { ClassRaster } from './raster.ts';
import { masterRowsAt } from './tiles.ts';

/**
 * The origin map drawn for the eye, over the world square (decision 0030) so the map can lay it over the
 * terrain as it lays the biomes.
 *
 * - Land that never moved is grey, with the terrain faintly in it so the world can still be read.
 * - Land that moved is coloured by which way it went and stronger the further it went, so a piece Adam
 *   moved is one patch of one colour.
 * - Invented land is magenta, striped. A copy of somewhere else is orange, striped.
 * - Earth's own coastline, carried through the origin map, is a thin white line. Where it lies on the painted
 *   coast the map has the piece right; where it wanders off, it has not.
 */

const SEA_COLOUR: [number, number, number] = [20, 35, 44];
const STILL: [number, number, number] = [170, 166, 150];
const INVENTED_COLOURS: [number, number, number][] = [
  [230, 0, 126],
  [255, 110, 190],
];
const CLONE_COLOURS: [number, number, number][] = [
  [255, 140, 26],
  [255, 196, 120],
];
const LINE: [number, number, number] = [255, 255, 255];
/** Degrees a piece must have travelled, or turned, before it is drawn as moved. */
const MOVED = 0.05;

export function originPicture(
  origin: OriginGrid,
  edited: ClassRaster,
  base: ClassRaster,
  sea: ReadonlySet<number>,
  side: number,
): RgbImage {
  const pixels = new Uint8Array(side * side * 3);
  const rows = masterRowsAt(side, edited.height);
  const tint = tintsOf(origin, edited.width);
  // Whether Earth had land under each pixel of the picture, through the origin map: 1 land, 0 sea, 255 unknown.
  let above = new Uint8Array(side).fill(255);
  let here = new Uint8Array(side);
  for (let py = 0; py < side; py += 1) {
    const my = rows[py]!;
    for (let px = 0; px < side; px += 1) {
      const mx = Math.min(edited.width - 1, Math.floor(((px + 0.5) * edited.width) / side));
      const ours = edited.cells[my * edited.width + mx]!;
      const k = Math.floor(my / origin.cell) * origin.columns + Math.floor(mx / origin.cell);
      const status = origin.status[k]!;
      here[px] =
        status === ORIGIN_EARTH || status === ORIGIN_CLONE ? earthLandAt(origin, k, base, sea, mx, my) : 255;
      let colour: readonly number[];
      if (sea.has(ours)) colour = SEA_COLOUR;
      else if (status === ORIGIN_INVENTED) colour = INVENTED_COLOURS[stripe(px, py)]!;
      else if (status === ORIGIN_CLONE) colour = CLONE_COLOURS[stripe(px, py)]!;
      else colour = shade(tint, k, ours);
      const at = (py * side + px) * 3;
      const left = px > 0 ? here[px - 1]! : 255;
      const edge =
        here[px] !== 255 &&
        ((left !== 255 && left !== here[px]) || (above[px] !== 255 && above[px] !== here[px]));
      pixels.set(edge ? LINE : colour, at);
    }
    [above, here] = [here, above];
  }
  return { width: side, height: side, pixels };
}

function stripe(px: number, py: number): number {
  return Math.floor((px + py) / 4) % 2;
}

function earthLandAt(
  origin: OriginGrid,
  k: number,
  base: ClassRaster,
  sea: ReadonlySet<number>,
  mx: number,
  my: number,
): number {
  const cx = (k % origin.columns) * origin.cell + origin.cell / 2;
  const cy = Math.floor(k / origin.columns) * origin.cell + origin.cell / 2;
  const dx = mx + 0.5 - cx;
  const dy = my + 0.5 - cy;
  let u = Math.floor(origin.x[k]! + origin.a[k]! * dx + origin.b[k]! * dy);
  const v = Math.floor(origin.y[k]! + origin.c[k]! * dx + origin.d[k]! * dy);
  if (v < 0 || v >= base.height) return 255;
  u = ((u % base.width) + base.width) % base.width;
  return sea.has(base.cells[v * base.width + u]!) ? 0 : 1;
}

/** The colour of each square from Earth: grey if it stayed, a hue for the way it went if it moved. */
function tintsOf(origin: OriginGrid, width: number): Float32Array {
  const tints = new Float32Array(origin.status.length * 3);
  for (let k = 0; k < origin.status.length; k += 1) {
    const cx = (k % origin.columns) * origin.cell + origin.cell / 2;
    const cy = Math.floor(k / origin.columns) * origin.cell + origin.cell / 2;
    let dx = cx - origin.x[k]!;
    if (dx > width / 2) dx -= width;
    if (dx < -width / 2) dx += width;
    const dy = cy - origin.y[k]!;
    const degrees = (Math.hypot(dx, dy) * 360) / width;
    const turned = Math.abs((Math.atan2(-origin.b[k]!, origin.d[k]!) * 180) / Math.PI);
    const colour =
      degrees < MOVED && turned < MOVED * 10
        ? STILL
        : hsl(Math.atan2(-dy, dx), Math.min(1, Math.log1p(degrees) / Math.log1p(30)));
    tints.set(colour, k * 3);
  }
  return tints;
}

/** A hue for a direction, east red and round through north; deeper the further it went. */
function hsl(direction: number, far: number): [number, number, number] {
  const hue = ((direction / (2 * Math.PI)) * 360 + 360) % 360;
  const saturation = 0.35 + 0.5 * far;
  const lightness = 0.72 - 0.27 * far;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const [r, g, b] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const m = lightness - chroma / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function shade(tint: Float32Array, k: number, terrain: number): number[] {
  const light = 0.84 + (0.16 * ((terrain * 37) % 7)) / 6;
  return [tint[k * 3]! * light, tint[k * 3 + 1]! * light, tint[k * 3 + 2]! * light];
}

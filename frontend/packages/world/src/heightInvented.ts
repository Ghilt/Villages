import type { ClassRaster } from './raster.ts';

/**
 * Relief invented for invented land, for the relief (decision record 0090): land the origin map found nowhere on
 * Earth has no height of its own, so it is given ground of the kind Adam painted there. What he painted is the
 * only word on what it is like: bare rock and alpine meadow are a range, forest is hills, farmland and marsh
 * lie flat. Near Earth's land it takes on the roughness Earth has there instead, so a range he moved and the
 * ground he invented beside it are of a piece, and it fades in over its first few cells, so there is no cliff
 * where the two meet. Rolling where it is gentle and ridged where it is a range, the same every time it is cut.
 */

/** How rugged each kind of ground is when there is no Earth under it to say: nought flat, one a range. */
export const RUGGED_BY_CLASS: Readonly<Record<string, number>> = {
  'bare-rock': 1,
  'alpine-meadow': 0.85,
  ice: 0.6,
  'desert-stone': 0.35,
  'conifer-forest': 0.3,
  rainforest: 0.3,
  'polar-desert': 0.25,
  tundra: 0.25,
  'mixed-forest': 0.25,
  'broadleaf-forest': 0.25,
  scrub: 0.25,
  taiga: 0.2,
  'taiga-open': 0.2,
  'dry-forest': 0.2,
  heath: 0.2,
  meadow: 0.15,
  'desert-sand': 0.12,
  steppe: 0.1,
  savanna: 0.1,
  'farmland-with-woods': 0.08,
  farmland: 0.04,
  river: 0.02,
  paddy: 0.02,
  marsh: 0.01,
  bog: 0.01,
  floodplain: 0.01,
  'swamp-forest': 0.01,
  mangrove: 0.01,
};

/** How high invented ground at its most rugged swings, in metres: about as sharp as the Himalaya at 60 km. */
export const RANGE_METRES = 2200;
/** How many times its measured roughness Earth's ground is swung when invented land beside it takes it on. */
const ROUGHNESS_TO_SWING = 2.5;

/**
 * How rugged the master paints each cell of `step` pixels, by the mean of its classes, nought where a class is
 * not in the table: a grid `width / step` by `height / step`, row by row from the north.
 */
export function ruggednessOf(master: ClassRaster, classNames: readonly string[], step: number): Float32Array {
  const byId = Float32Array.from(classNames, (name) => RUGGED_BY_CLASS[name] ?? 0);
  const columns = Math.floor(master.width / step);
  const rows = Math.floor(master.height / step);
  const out = new Float32Array(columns * rows);
  // Every other pixel each way is plenty to read a cell's kind of ground.
  const stride = Math.max(1, Math.floor(step / 4));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let sum = 0;
      let n = 0;
      for (let y = row * step; y < (row + 1) * step; y += stride) {
        for (let x = column * step; x < (column + 1) * step; x += stride) {
          sum += byId[master.cells[y * master.width + x]!] ?? 0;
          n += 1;
        }
      }
      out[row * columns + column] = sum / n;
    }
  }
  return out;
}

/** How far each cell of invented ground swings, and how much of that swing it is given yet. */
export interface InventedGround {
  /** Metres. */
  readonly swing: Float32Array;
  /** From nought where it meets other land to one a few cells in. */
  readonly fade: Float32Array;
}

/**
 * The swing of every invented cell, eased between what its classes ask for and what the land around it has:
 * near Earth's land Earth's roughness, inland its own painting. `roughness` is Earth's measured spread in
 * metres for the cells that came from Earth, `rugged` the master's painting a cell, `rings` how many cells in
 * from other land each invented cell lies.
 */
export function inventedGround(
  columns: number,
  rows: number,
  invented: readonly number[],
  roughness: Float32Array,
  rugged: Float32Array,
  rings: Uint16Array,
  rounds = 96,
): InventedGround {
  const swing = Float32Array.from(roughness, (spread) => spread * ROUGHNESS_TO_SWING);
  const asked = new Float32Array(columns * rows);
  for (const at of invented) {
    asked[at] = (rugged[at] ?? 0) * RANGE_METRES;
    swing[at] = asked[at]!;
  }
  const cell = (c: number, r: number) =>
    Math.min(rows - 1, Math.max(0, r)) * columns + ((c + columns) % columns);
  // Each round a cell moves to its neighbours' mean, pulled a little back to what it asks for.
  const pull = 0.15;
  for (let round = 0; round < rounds; round += 1) {
    for (const at of invented) {
      const c = at % columns;
      const r = Math.floor(at / columns);
      const around =
        (swing[cell(c - 1, r)]! + swing[cell(c + 1, r)]! + swing[cell(c, r - 1)]! + swing[cell(c, r + 1)]!) /
        4;
      swing[at] = (1 - pull) * around + pull * asked[at]!;
    }
  }
  const fade = new Float32Array(columns * rows);
  for (const at of invented) {
    const t = Math.min(1, Math.max(0, (rings[at]! - 0.5) / 3));
    fade[at] = t * t * (3 - 2 * t);
  }
  return { swing, fade };
}

const GRADIENTS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7071, 0.7071],
  [-0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, -0.7071],
] as const;

function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Gradient noise, about -1 to 1, the same at the same place every time. */
export function gradientNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const corner = (ix: number, iy: number, dx: number, dy: number) => {
    const [gx, gy] = GRADIENTS[hash(ix, iy) & 7]!;
    return gx * dx + gy * dy;
  };
  const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const u = ease(fx);
  const v = ease(fy);
  const top = corner(x0, y0, fx, fy) * (1 - u) + corner(x0 + 1, y0, fx - 1, fy) * u;
  const bottom = corner(x0, y0 + 1, fx, fy - 1) * (1 - u) + corner(x0 + 1, y0 + 1, fx - 1, fy - 1) * u;
  return (top * (1 - v) + bottom * v) * 1.4;
}

/**
 * The widest wave of invented ground, in master pixels: about 60 km, a valley and the ridges either side of it.
 * Wider waves gave the swing so gentle a slope that a range barely shaded; the fill carries the broad shape.
 */
const WIDEST = 48;
const OCTAVES = 6;
const WEIGHTS = Array.from({ length: OCTAVES }, (_, o) => 0.55 ** o);
const TOTAL = WEIGHTS.reduce((sum, weight) => sum + weight, 0);

/**
 * Invented ground at a master pixel, about -1 to 1: rolling where `range` is nought, ridged and mostly above its
 * surroundings where it is one. No wave narrower than twice `finest` pixels is added, so a tile far out is not
 * speckled with ground it is too coarse to show.
 */
export function inventedRelief(x: number, y: number, range: number, finest: number): number {
  // Warped a little, so its hills do not line up on the noise's own grid.
  const wx = x + 40 * gradientNoise(x / 256 + 5.2, y / 256 + 1.3);
  const wy = y + 40 * gradientNoise(x / 256 + 9.7, y / 256 + 2.8);
  let rolling = 0;
  let ridged = 0;
  let carried = 1;
  for (let o = 0; o < OCTAVES; o += 1) {
    const wave = WIDEST / 2 ** o;
    if (wave < 2 * finest) {
      break;
    }
    const n = gradientNoise(wx / wave + o * 17.3, wy / wave - o * 9.1);
    if (range < 0.95) {
      rolling += n * WEIGHTS[o]!;
    }
    if (range > 0.05) {
      const ridge = (1 - Math.abs(n)) ** 2 * carried;
      carried = Math.min(1, ridge * 2);
      ridged += ridge * WEIGHTS[o]!;
    }
  }
  return (1 - range) * (rolling / TOTAL) * 1.6 + range * (ridged / TOTAL) * 1.8;
}

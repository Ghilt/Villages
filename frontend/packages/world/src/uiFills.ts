/**
 * The placeholder fills: parchment, night, dark wood and velvet, painted as pixels that repeat without a
 * seam, so a pane of any size can be filled with one small picture.
 *
 * Painted here rather than drawn as SVG because the SVG renderer's own noise does not quite repeat: its
 * tiles meet in a faint line, which is the one thing a fill must never show. The noise here wraps by
 * construction, the way the map's does in `noise.ts`: the lattice it is made from is a torus. They are
 * the agent's stand-ins, rough on purpose, until Adam paints fills of his own. See decision record 0068.
 */

function hash(x: number, y: number, seed: number): number {
  let h = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

const ease = (t: number): number => t * t * (3 - 2 * t);

/**
 * Value noise in [0, 1] at a place in a picture `size` pixels square, over a lattice of `cellsX` by
 * `cellsY` cells that wraps at both edges: the column after the last is the first again, and so is the
 * row. So a picture painted from it repeats without a seam.
 */
export function wrappingNoise(
  x: number,
  y: number,
  size: number,
  cellsX: number,
  cellsY: number,
  seed: number,
): number {
  const u = (x / size) * cellsX;
  const v = (y / size) * cellsY;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = ease(u - x0);
  const fy = ease(v - y0);
  const wx = (at: number) => ((at % cellsX) + cellsX) % cellsX;
  const wy = (at: number) => ((at % cellsY) + cellsY) % cellsY;
  const c00 = hash(wx(x0), wy(y0), seed);
  const c10 = hash(wx(x0 + 1), wy(y0), seed);
  const c01 = hash(wx(x0), wy(y0 + 1), seed);
  const c11 = hash(wx(x0 + 1), wy(y0 + 1), seed);
  return c00 + (c10 - c00) * fx + (c01 - c00) * fy + (c00 - c10 - c01 + c11) * fx * fy;
}

/** Several octaves of it, each twice as fine and half as strong, still wrapping: in [0, 1]. */
export function wrappingFbm(
  x: number,
  y: number,
  size: number,
  cells: readonly [number, number],
  octaves: number,
  seed: number,
): number {
  let sum = 0;
  let weight = 0;
  let strength = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    const scale = 2 ** octave;
    sum += strength * wrappingNoise(x, y, size, cells[0] * scale, cells[1] * scale, seed + octave * 101);
    weight += strength;
    strength /= 2;
  }
  return sum / weight;
}

export const FILL_NAMES = ['parchment', 'night', 'dark-wood', 'velvet'] as const;
export type FillName = (typeof FILL_NAMES)[number];

type Rgb = readonly [number, number, number];

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

/**
 * Noise in [0, 1] pulled out to [-1, 1] and past it. Octaves averaged together huddle round the middle, so
 * without this a fill has a tenth of the light and shade it was asked for.
 */
const spread = (value: number, by: number) => Math.max(-1, Math.min(1, (value - 0.5) * 2 * by));

/** Light and shade laid over a colour: `by` from -1, darkest, to 1, lightest, `reach` apart. */
function shade(base: Rgb, by: number, reach: number): Rgb {
  return [
    clamp(base[0] + by * reach),
    clamp(base[1] + by * reach * 0.94),
    clamp(base[2] + by * reach * 0.85),
  ];
}

/** The colour of one pixel of a fill. `size` is the picture's width and height, which are one. */
function fillPixel(name: FillName, x: number, y: number, size: number): Rgb {
  switch (name) {
    case 'parchment': {
      // Mottled, the way old paper foxes, with faint fibres lying across it and the odd darker fleck.
      const mottle = spread(wrappingFbm(x, y, size, [3, 3], 5, 11), 2.6);
      const stain = Math.min(0, spread(wrappingFbm(x, y, size, [2, 2], 3, 13), 2.2));
      const fibre = spread(wrappingFbm(x, y, size, [2, 40], 3, 23), 1.6);
      const fleck = wrappingNoise(x, y, size, 96, 96, 37) > 0.985 ? -0.6 : 0;
      return shade([204, 182, 146], mottle * 0.55 + stain * 0.45 + fibre * 0.12 + fleck, 34);
    }
    case 'night': {
      const cloud = spread(wrappingFbm(x, y, size, [2, 2], 4, 41), 2.4);
      const grain = spread(wrappingNoise(x, y, size, 128, 128, 43), 1);
      return shade([29, 25, 20], cloud * 0.8 + grain * 0.25, 10);
    }
    case 'dark-wood': {
      // Rings a whole number of times down the picture, pushed about by noise, so the grain wraps too.
      const warp = wrappingFbm(x, y, size, [2, 3], 4, 53);
      const ring = Math.sin(((y / size) * 4 + spread(warp, 2) * 1.4) * Math.PI * 2);
      const streak = spread(wrappingFbm(x, y, size, [3, 48], 2, 59), 1.8);
      return shade([70, 47, 30], ring * 0.4 + streak * 0.5, 24);
    }
    case 'velvet': {
      // Folds hanging down it, a whole number across, and the sheen of the pile over them.
      const sway = wrappingFbm(x, y, size, [2, 2], 3, 61);
      const fold = Math.sin(((x / size) * 5 + spread(sway, 2) * 0.12) * Math.PI * 2);
      const pile = spread(wrappingNoise(x, y, size, 128, 128, 67), 1);
      return shade([104, 40, 32], fold * 0.8 + pile * 0.12, 28);
    }
  }
}

/** A fill, `size` pixels square, as RGBA bytes: opaque, and repeating without a seam. */
export function paintFill(name: FillName, size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = fillPixel(name, x, y, size);
      const at = (y * size + x) * 4;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
      data[at + 3] = 255;
    }
  }
  return data;
}

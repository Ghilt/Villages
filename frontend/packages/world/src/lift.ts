/**
 * Lifting a thing off the little block of ground it was drawn standing on.
 *
 * A picture made by an image model often comes as a diorama: the tree, or the rock, or the reeds, on a
 * square of turf with soil down its sides, seen from a corner, on a pale paper with a soft shadow beside
 * it. The map has ground of its own, so the turf, the soil, the paper and the shadow all go, and what
 * stood on the turf stays - its trunk, its roots, its stems - down to where it met the turf.
 *
 * It is done in three moves, each a rule about where things are rather than a guess about what they are:
 *
 * - **The plinth is found by its soil**, the one brown band at the bottom that reaches the lowest point of
 *   the picture. Its two lower edges give the plinth's corner and its slope, its right end gives its width,
 *   and the left side face, which nothing ever stands in front of, gives its height.
 * - **Around the plinth, the paper and the shadow go.** The paper is filled from the border, as `keyOut`
 *   does. The shadow is only ever on the floor beside the plinth, grows out of the paper through smooth
 *   steps, and is never as dark as a rock's shaded face, which is edged. Paper that the fill could not
 *   reach - seen between leaves - goes when what rings it is mostly not paper.
 * - **On the plinth, the thing is told from the ground by two palettes** the picture itself supplies: the
 *   ground's, from the front strip of the turf, which nothing stands on; and the thing's, from where it
 *   crosses into the plinth. A colour the thing shows joins it any way it touches; a colour neither palette
 *   has seen - a trunk hidden under its crown - counts only hanging straight down from what stands above,
 *   so the stones and the litter strewn at a trunk's foot, which touch it only along the ground, do not.
 *
 * A picture it finds no plinth in is not touched here. See `docs/AUTHORING-THE-ART.md` and decision record
 * 0059.
 */

import type { Keyed, Rgba } from './art.ts';

export interface Point {
  x: number;
  y: number;
}

/** The block of ground a diorama stands on, as found in the picture. */
export interface Plinth {
  /** The front corner of the soil: the lowest point of the plinth. */
  bottom: Point;
  /** How far the plinth's edges rise for every pixel across. Near 0.58 for a true isometric view. */
  rise: number;
  /** From the front corner to either side. */
  halfWidth: number;
  /** How tall the side faces are, turf and soil together. */
  sides: number;
  /** The corners of the top face, the one that is seen from above and stood on. */
  top: { left: Point; back: Point; right: Point; front: Point };
  /** The whole block's outline: the top face and the two side faces below its front edges. */
  outline: Point[];
}

/** Every length below is written for the size these pictures come in, a plinth about 566 pixels wide. */
const MODEL_HALF_WIDTH = 283;

/** Within this of the paper a pixel is paper. */
const PAPER = 16;
/** The largest step between neighbours the shadow grows across. A rock's edge is a larger one. */
const STEP = 8;
/** The shadow is colourless, never brighter than the paper, and never as dark as a shaded face. */
const SHADOW_CHROMA = 26;
const SHADOW_DARKEST = 115;
const SHADOW_OVER_PAPER = 6;
/** What rings a pocket of paper between leaves: something this far from the paper, or this colourful. */
const NOT_PAPER = 60;
const RING_CHROMA = 18;
/** How much of what rings a piece of paper must be not paper for it to be a pocket. */
const POCKET_RING = 0.5;
/** How common a colour must be in a palette, as a share of it, for the palette to know it. */
const KNOWN = 0.001;
/** How much of each channel the plinth's own shadow takes from the turf, at its darkest. */
const SHADE = [0.47, 0.38, 0.33] as const;

/** The largest and smallest the soil band can be, as a share of the side faces' height. */
const SOIL_SHARE = { least: 0.15, most: 0.9 } as const;

type Mask = Uint8Array;

const chromaAt = (data: Uint8Array, at: number): number =>
  Math.max(data[at]!, data[at + 1]!, data[at + 2]!) - Math.min(data[at]!, data[at + 1]!, data[at + 2]!);

const lumAt = (data: Uint8Array, at: number): number => (data[at]! + data[at + 1]! + data[at + 2]!) / 3;

function distance(data: Uint8Array, at: number, colour: readonly number[]): number {
  return Math.max(
    Math.abs(data[at]! - colour[0]!),
    Math.abs(data[at + 1]! - colour[1]!),
    Math.abs(data[at + 2]! - colour[2]!),
  );
}

function stepBetween(data: Uint8Array, one: number, other: number): number {
  return Math.max(
    Math.abs(data[one * 4]! - data[other * 4]!),
    Math.abs(data[one * 4 + 1]! - data[other * 4 + 1]!),
    Math.abs(data[one * 4 + 2]! - data[other * 4 + 2]!),
  );
}

/** How many steps, across and down, from every pixel to the nearest one in the mask. */
function cityBlock(mask: Mask, width: number, height: number): Int32Array {
  const far = width + height;
  const out = new Int32Array(width * height);
  for (let at = 0; at < out.length; at += 1) {
    out[at] = mask[at] === 1 ? 0 : far;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      if (x > 0) out[at] = Math.min(out[at]!, out[at - 1]! + 1);
      if (y > 0) out[at] = Math.min(out[at]!, out[at - width]! + 1);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const at = y * width + x;
      if (x < width - 1) out[at] = Math.min(out[at]!, out[at + 1]! + 1);
      if (y < height - 1) out[at] = Math.min(out[at]!, out[at + width]! + 1);
    }
  }
  return out;
}

function dilate(mask: Mask, by: number, width: number, height: number): Mask {
  const reach = cityBlock(mask, width, height);
  const out = new Uint8Array(mask.length);
  for (let at = 0; at < out.length; at += 1) {
    if (reach[at]! <= by) out[at] = 1;
  }
  return out;
}

function erode(mask: Mask, by: number, width: number, height: number): Mask {
  // What lies outside the picture counts as outside the mask, so a mask erodes from the frame too.
  const outside = new Uint8Array(mask.length);
  for (let at = 0; at < mask.length; at += 1) {
    if (mask[at] !== 1) outside[at] = 1;
  }
  const reach = cityBlock(outside, width, height);
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    const fromTopOrBottom = Math.min(y + 1, height - y);
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      if (mask[at] === 1 && reach[at]! > by && Math.min(fromTopOrBottom, x + 1, width - x) > by) out[at] = 1;
    }
  }
  return out;
}

const open = (mask: Mask, by: number, width: number, height: number): Mask =>
  dilate(erode(mask, by, width, height), by, width, height);

/** Keeps only runs across a row at least `wide` long. */
function openAcross(mask: Mask, wide: number, width: number, height: number): Mask {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    let start = -1;
    for (let x = 0; x <= width; x += 1) {
      const on = x < width && mask[y * width + x] === 1;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= wide) out.fill(1, y * width + start, y * width + x);
        start = -1;
      }
    }
  }
  return out;
}

const NEIGHBOURS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/** Everything in `ok` joined to a seed, side by side. Seeds outside `ok` seed nothing. */
function floodFrom(ok: Mask, seeds: Mask, width: number, height: number): Mask {
  const out = new Uint8Array(ok.length);
  const stack: number[] = [];
  for (let at = 0; at < ok.length; at += 1) {
    if (seeds[at] === 1 && ok[at] === 1) {
      out[at] = 1;
      stack.push(at);
    }
  }
  while (stack.length > 0) {
    const at = stack.pop()!;
    const x = at % width;
    const y = (at - x) / width;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (out[next] === 0 && ok[next] === 1) {
        out[next] = 1;
        stack.push(next);
      }
    }
  }
  return out;
}

/** From the seeds, through `ok`, never across a step between neighbours larger than `step`. */
function growFrom(
  ok: Mask,
  seeds: Mask,
  data: Uint8Array,
  step: number,
  width: number,
  height: number,
): Mask {
  const out = Uint8Array.from(seeds);
  const stack: number[] = [];
  for (let at = 0; at < seeds.length; at += 1) {
    if (seeds[at] === 1) stack.push(at);
  }
  while (stack.length > 0) {
    const at = stack.pop()!;
    const x = at % width;
    const y = (at - x) / width;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (out[next] === 0 && ok[next] === 1 && stepBetween(data, at, next) <= step) {
        out[next] = 1;
        stack.push(next);
      }
    }
  }
  return out;
}

/** The pieces of a mask, side by side: a label for every pixel (0 for none) and each piece's size. */
function pieces(mask: Mask, width: number, height: number): { labels: Int32Array; sizes: number[] } {
  const labels = new Int32Array(mask.length);
  const sizes = [0];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || labels[start] !== 0) continue;
    const label = sizes.length;
    let size = 0;
    labels[start] = label;
    stack.push(start);
    while (stack.length > 0) {
      const at = stack.pop()!;
      size += 1;
      const x = at % width;
      const y = (at - x) / width;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (mask[next] === 1 && labels[next] === 0) {
          labels[next] = label;
          stack.push(next);
        }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

/** The pixels inside a convex polygon, edge pixels included. */
function polygon(points: readonly Point[], width: number, height: number): Mask {
  const out = new Uint8Array(width * height);
  let area = 0;
  for (let at = 0; at < points.length; at += 1) {
    const a = points[at]!;
    const b = points[(at + 1) % points.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  const turn = Math.sign(area) || 1;
  const top = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
  const bottom = Math.min(height - 1, Math.ceil(Math.max(...points.map((p) => p.y))));
  const left = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x))));
  const right = Math.min(width - 1, Math.ceil(Math.max(...points.map((p) => p.x))));
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      let inside = true;
      for (let at = 0; at < points.length && inside; at += 1) {
        const a = points[at]!;
        const b = points[(at + 1) % points.length]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const side = ((b.x - a.x) * (y + 0.5 - a.y) - (b.y - a.y) * (x + 0.5 - a.x)) / length;
        inside = side * turn >= -0.5;
      }
      if (inside) out[y * width + x] = 1;
    }
  }
  return out;
}

/** The median of a list, which is sorted in place. */
function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

/**
 * The plinth a diorama stands on, or null when the picture has none - or none this can be sure of, which
 * is the same answer: a picture with no plinth is cut exactly as it was before there was a way to lift one.
 */
export function findPlinth(image: Rgba): Plinth | null {
  const { width, height, data } = image;
  const soil = new Uint8Array(width * height);
  let lowest = -1;
  for (let y = Math.floor(height / 2); y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      const [r, g, b] = [data[at]!, data[at + 1]!, data[at + 2]!];
      const lum = (r + g + b) / 3;
      if (data[at + 3]! > 200 && r > g + 6 && g > b - 2 && r - b > 18 && lum > 45 && lum < 200) {
        soil[y * width + x] = 1;
        lowest = y * width + x;
      }
    }
  }
  if (lowest < 0) return null;
  // The soil is the brown band that reaches the lowest point: a trunk, or mud on the turf, is brown too.
  const { labels, sizes } = pieces(soil, width, height);
  const band = labels[lowest]!;
  if (sizes[band]! < width * height * 0.002) return null;
  const low = new Int32Array(width).fill(-1);
  const high = new Int32Array(width).fill(-1);
  for (let at = 0; at < labels.length; at += 1) {
    if (labels[at] !== band) continue;
    const x = at % width;
    const y = (at - x) / width;
    if (high[x] === -1) high[x] = y;
    low[x] = y;
  }
  const columns = [...low.keys()].filter((x) => low[x]! >= 0);
  const bottomY = Math.max(...columns.map((x) => low[x]!));
  const bottomX = median(columns.filter((x) => low[x]! >= bottomY - 1));
  const rightX = Math.max(...columns);
  const halfWidth = rightX - bottomX;
  if (halfWidth < width * 0.12) return null;
  const scale = halfWidth / MODEL_HALF_WIDTH;

  // The rise, from the right-hand edge of the soil, which is lit and clean.
  const fit = columns.filter((x) => x > bottomX + 20 * scale && x < rightX - 20 * scale);
  if (fit.length < 10) return null;
  const meanX = fit.reduce((sum, x) => sum + x, 0) / fit.length;
  const meanY = fit.reduce((sum, x) => sum + low[x]!, 0) / fit.length;
  let across = 0;
  let along = 0;
  for (const x of fit) {
    across += (x - meanX) * (low[x]! - meanY);
    along += (x - meanX) ** 2;
  }
  const rise = -across / along;
  if (!(rise > 0.35 && rise < 0.8)) return null;
  const sideBottom = bottomY - rise * halfWidth;

  // The side faces' height, read up the shaded left face, where nothing ever stands: from the top of the
  // soil, up the side's own band, to the bright rim along the top face's front edge.
  const leftX = 2 * bottomX - rightX;
  const spans: number[] = [];
  const soilDepths: number[] = [];
  const stride = Math.max(1, Math.round(4 * scale));
  for (let x = Math.round(leftX + 40 * scale); x < bottomX - 40 * scale; x += stride) {
    if (x < 0 || high[x]! < 0) continue;
    const soilTop = high[x]!;
    soilDepths.push(low[x]! - soilTop);
    const band: number[][] = [[], [], []];
    for (let y = soilTop - Math.round(8 * scale); y < soilTop - 2; y += 1) {
      for (let channel = 0; channel < 3; channel += 1)
        band[channel]!.push(data[(y * width + x) * 4 + channel]!);
    }
    const sideColour = band.map((values) => median(values));
    for (let y = soilTop - 3; y > soilTop - 90 * scale && y > 0; y -= 1) {
      if (distance(data, (y * width + x) * 4, sideColour) > 22) {
        spans.push(bottomY - rise * (bottomX - x) - y);
        break;
      }
    }
  }
  if (spans.length < 5) return null;
  const sides = median(spans);
  const soilDepth = median(soilDepths);
  if (!(soilDepth > sides * SOIL_SHARE.least && soilDepth < sides * SOIL_SHARE.most)) return null;

  const front = { x: bottomX, y: bottomY - sides };
  const left = { x: leftX, y: sideBottom - sides };
  const right = { x: rightX, y: sideBottom - sides };
  const back = { x: bottomX, y: bottomY - sides - 2 * rise * halfWidth };
  return {
    bottom: { x: bottomX, y: bottomY },
    rise,
    halfWidth,
    sides,
    top: { left, back, right, front },
    outline: [
      left,
      back,
      right,
      { x: rightX, y: sideBottom },
      { x: bottomX, y: bottomY },
      { x: leftX, y: sideBottom },
    ],
  };
}

/** A palette: how often each colour, to a 32-level cube, turns up in a set of samples, smoothed a little. */
class Palette {
  private readonly bins = new Float32Array(32 * 32 * 32);

  add(red: number, green: number, blue: number): void {
    const bin = (c: number) => Math.max(0, Math.min(31, Math.floor(c / 8)));
    this.bins[bin(red) * 1024 + bin(green) * 32 + bin(blue)]! += 1;
  }

  /** Smooths it by a Gaussian of one bin, as far as four bins, and makes it shares of the whole. */
  settle(): this {
    const kernel = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((d) => Math.exp((-d * d) / 2));
    const sum = kernel.reduce((a, b) => a + b, 0);
    const weights = kernel.map((w) => w / sum);
    const reflect = (i: number) => (i < 0 ? -i - 1 : i > 31 ? 63 - i : i);
    for (const stride of [1024, 32, 1]) {
      const copy = Float32Array.from(this.bins);
      for (let at = 0; at < this.bins.length; at += 1) {
        const along = Math.floor(at / stride) % 32;
        let value = 0;
        for (let k = 0; k < 9; k += 1) {
          value += weights[k]! * copy[at + (reflect(along + k - 4) - along) * stride]!;
        }
        this.bins[at] = value;
      }
    }
    const total = this.bins.reduce((a, b) => a + b, 0) || 1;
    for (let at = 0; at < this.bins.length; at += 1) this.bins[at]! /= total;
    return this;
  }

  at(data: Uint8Array, at: number): number {
    return this.bins[(data[at]! >> 3) * 1024 + (data[at + 1]! >> 3) * 32 + (data[at + 2]! >> 3)]!;
  }
}

/**
 * Takes the plinth, the paper and the shadow away from a diorama, and keeps what stood on it.
 *
 * `background` is the paper's colour, read off the border. What comes back is the picture with its alpha
 * set: the thing whole, everything else see-through, and the edges the thing shares with the paper
 * feathered and unmixed, as `keyOut` does, so no tree carries a rim of the paper it was drawn on.
 */
export function liftOffPlinth(
  image: Rgba,
  plinth: Plinth,
  background: readonly [number, number, number],
): Keyed {
  const { width, height, data } = image;
  const size = width * height;
  const scale = plinth.halfWidth / MODEL_HALF_WIDTH;
  const px = (n: number) => Math.max(1, Math.round(n * scale));
  const paperLum = (background[0] + background[1] + background[2]) / 3;
  const diff = new Uint8Array(size);
  const chroma = new Uint8Array(size);
  const lum = new Float32Array(size);
  for (let p = 0; p < size; p += 1) {
    diff[p] = distance(data, p * 4, background);
    chroma[p] = chromaAt(data, p * 4);
    lum[p] = lumAt(data, p * 4);
  }
  const all = (test: (p: number) => boolean): Mask => {
    const out = new Uint8Array(size);
    for (let p = 0; p < size; p += 1) out[p] = test(p) ? 1 : 0;
    return out;
  };
  const yOf = (p: number) => Math.floor(p / width);
  const xOf = (p: number) => p % width;

  // The plinth, and the parts of it that matter.
  const block = polygon(plinth.outline, width, height);
  const inside = dilate(block, px(8), width, height);
  const topFace = polygon(
    [plinth.top.left, plinth.top.back, plinth.top.right, plinth.top.front],
    width,
    height,
  );
  const sidesBelow = dilate(
    all((p) => block[p] === 1 && topFace[p] === 0),
    2,
    width,
    height,
  );
  const sides = all((p) => topFace[p] === 0 && sidesBelow[p] === 1);
  const blockCore = erode(block, px(8), width, height);
  const rimBand = all((p) => inside[p] === 1 && blockCore[p] === 0 && sides[p] === 0);
  const frontEdge = (x: number) => plinth.top.front.y - plinth.rise * Math.abs(x - plinth.top.front.x);
  const strip = all((p) => topFace[p] === 1 && yOf(p) > frontEdge(xOf(p)) - 50 * scale);

  // The paper, filled from the border.
  const border = all((p) => {
    const x = xOf(p);
    const y = yOf(p);
    return x === 0 || y === 0 || x === width - 1 || y === height - 1;
  });
  const paperish = all((p) => diff[p]! <= PAPER);
  let backdrop = floodFrom(paperish, border, width, height);
  // The shadow: on the floor beside the plinth, colourless, no brighter than the paper and never as dark
  // as a shaded face, grown out of the paper through smooth steps only.
  const floorFrom = plinth.top.left.y - 140 * scale;
  const shadowlike = all(
    (p) =>
      (inside[p] === 0 &&
        yOf(p) > floorFrom &&
        chroma[p]! <= SHADOW_CHROMA &&
        lum[p]! <= paperLum + SHADOW_OVER_PAPER &&
        lum[p]! >= SHADOW_DARKEST) ||
      backdrop[p] === 1,
  );
  const shadowAndPaper = growFrom(shadowlike, backdrop, data, STEP, width, height);
  const shadow = all((p) => shadowAndPaper[p] === 1 && backdrop[p] === 0);
  // Paper the shadow band had cut off from the border.
  backdrop = floodFrom(
    paperish,
    all((p) => backdrop[p] === 1 || shadow[p] === 1),
    width,
    height,
  );
  let open_ = all((p) => backdrop[p] === 0 && shadow[p] === 0 && inside[p] === 0);
  // The plinth's halo: a line or two of pixels just outside its edge, too thin to be anything but ringing.
  const aroundPlinth = dilate(inside, px(15), width, height);
  const nearPlinth = all((p) => aroundPlinth[p] === 1 && inside[p] === 0);
  const opened = open(open_, 1, width, height);
  const halo = all((p) => open_[p] === 1 && nearPlinth[p] === 1 && opened[p] === 0);
  open_ = all((p) => open_[p] === 1 && halo[p] === 0);

  // Pockets: paper the fill could not reach, seen between leaves - the colour of the paper itself, and
  // ringed mostly by things that are not paper. Pale bark comes that close to the paper too, but bark is
  // ringed by more pale bark.
  const paper = all((p) => diff[p]! <= PAPER && open_[p] === 1);
  const pockets = new Uint8Array(size);
  {
    const { labels, sizes } = pieces(paper, width, height);
    const stamp = new Int32Array(size);
    const counted = new Int32Array(sizes.length);
    const far = new Int32Array(sizes.length);
    for (let p = 0; p < size; p += 1) {
      const label = labels[p]!;
      if (label === 0) continue;
      const x = xOf(p);
      const y = yOf(p);
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2 + Math.abs(dy); dx <= 2 - Math.abs(dy); dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (labels[q] === label || paper[q] === 1 || shadow[q] === 1 || halo[q] === 1 || stamp[q] === label)
            continue;
          stamp[q] = label;
          counted[label]! += 1;
          if (diff[q]! >= NOT_PAPER || chroma[q]! >= RING_CHROMA) far[label]! += 1;
        }
      }
    }
    for (let p = 0; p < size; p += 1) {
      const label = labels[p]!;
      if (label !== 0 && counted[label]! > 0 && far[label]! / counted[label]! >= POCKET_RING) pockets[p] = 1;
    }
  }
  const outside = all((p) => open_[p] === 1 && pockets[p] === 0);

  // The palettes. The ground's is the front strip of the turf, which nothing stands on, in shade and in
  // stronger sun as well; its rim, where the turf meets the paper, is the same blended into the paper.
  const ground = new Palette();
  const rim = new Palette();
  for (let p = 0; p < size; p += 1) {
    if (strip[p] !== 1) continue;
    const [r, g, b] = [data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!];
    ground.add(r, g, b);
    for (const f of [0.25, 0.5, 0.75, 1])
      ground.add(r * (1 - f * SHADE[0]), g * (1 - f * SHADE[1]), b * (1 - f * SHADE[2]));
    for (const m of [1.08, 1.16]) ground.add(r * m, g * m, b * m);
    for (const s of [0.2, 0.4, 0.6, 0.8]) {
      rim.add(
        r * (1 - s) + background[0] * s,
        g * (1 - s) + background[1] * s,
        b * (1 - s) + background[2] * s,
      );
    }
  }
  ground.settle();
  rim.settle();
  // The thing's is whatever of it crosses into the plinth, read just above where it does.
  const thing = new Palette();
  const nearInside = dilate(inside, px(3), width, height);
  for (let p = 0; p < size; p += 1) {
    if (nearInside[p] === 1 && outside[p] === 1) thing.add(data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!);
  }
  thing.settle();
  // The rim is where the turf meets the paper, so its colours are ground only within reach of the paper,
  // and not where a trunk crosses the plinth's edge.
  const nearPaper = dilate(
    all((p) => backdrop[p] === 1 || shadow[p] === 1 || halo[p] === 1),
    px(4),
    width,
    height,
  );
  const rimZone = all((p) => rimBand[p] === 1 && nearPaper[p] === 1);
  const usable = all((p) => inside[p] === 1 && strip[p] === 0 && sides[p] === 0);
  const known = new Uint8Array(size);
  const unknown = new Uint8Array(size);
  for (let p = 0; p < size; p += 1) {
    if (usable[p] !== 1) continue;
    const ofThing = thing.at(data, p * 4);
    const ofGround =
      rimZone[p] === 1 ? Math.max(ground.at(data, p * 4), rim.at(data, p * 4)) : ground.at(data, p * 4);
    if (ofThing >= KNOWN && ofThing > ofGround) known[p] = 1;
    else if (ofGround < KNOWN) unknown[p] = 1;
  }

  // A colour the thing shows joins it any way it touches.
  const knownOpened = open(known, 1, width, height);
  const joined = floodFrom(
    all((p) => knownOpened[p] === 1 || outside[p] === 1),
    outside,
    width,
    height,
  );
  // A colour neither palette knows counts only hanging straight down from what stands above - the
  // trunk under a crown - and only as a block: a streak a few pixels wide is plate or litter strung
  // below a foot, column by column.
  const held = all((p) => outside[p] === 1 || joined[p] === 1);
  for (let y = 1; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (unknown[p] === 1 && held[p - width] === 1) held[p] = 1;
    }
  }
  const hung = all((p) => held[p] === 1 && inside[p] === 1 && joined[p] === 0);
  const wide = openAcross(
    all((p) => hung[p] === 1 || (joined[p] === 1 && inside[p] === 1)),
    px(9),
    width,
    height,
  );
  let keep = all(
    (p) => outside[p] === 1 || (joined[p] === 1 && inside[p] === 1) || (hung[p] === 1 && wide[p] === 1),
  );
  {
    const { labels, sizes } = pieces(keep, width, height);
    const least = 300 * scale * scale;
    keep = Uint8Array.from(labels, (label) => (label !== 0 && sizes[label]! >= least ? 1 : 0));
  }

  const removedPaper = all((p) => backdrop[p] === 1 || shadow[p] === 1 || halo[p] === 1 || pockets[p] === 1);
  return { image: feather(image, keep, removedPaper, background), background };
}

/** How far in from an edge pixel the solid thing it is a mix of is looked for. */
const FRINGE_REACH = 2;

/**
 * The lifted picture: the thing opaque, the rest see-through, and every pixel it shares with the paper
 * given as much alpha as it is thing, with the paper's colour taken out of it. The paper there is the
 * paper beside it - the shadow, where it is the shadow - rather than one colour for the whole picture.
 */
function feather(image: Rgba, keep: Mask, paper: Mask, background: readonly [number, number, number]): Rgba {
  const { width, height, data } = image;
  const out = new Uint8Array(data);
  const edge = new Uint8Array(width * height);
  for (let p = 0; p < keep.length; p += 1) {
    if (keep[p] !== 1) continue;
    const x = p % width;
    const y = (p - x) / width;
    for (let dy = -1; dy <= 1 && edge[p] === 0; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && paper[ny * width + nx] === 1) {
          edge[p] = 1;
          break;
        }
      }
    }
  }
  for (let p = 0; p < keep.length; p += 1) {
    const at = p * 4;
    if (keep[p] !== 1) {
      out[at] = background[0];
      out[at + 1] = background[1];
      out[at + 2] = background[2];
      out[at + 3] = 0;
      continue;
    }
    if (edge[p] !== 1) continue;
    const x = p % width;
    const y = (p - x) / width;
    const inner = [0, 0, 0];
    const beside = [0, 0, 0];
    let solid = 0;
    let paperCount = 0;
    for (let dy = -FRINGE_REACH; dy <= FRINGE_REACH; dy += 1) {
      for (let dx = -FRINGE_REACH; dx <= FRINGE_REACH; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (keep[q] === 1 && edge[q] === 0) {
          for (let c = 0; c < 3; c += 1) inner[c]! += data[q * 4 + c]!;
          solid += 1;
        } else if (paper[q] === 1 && Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
          for (let c = 0; c < 3; c += 1) beside[c]! += data[q * 4 + c]!;
          paperCount += 1;
        }
      }
    }
    if (solid === 0 || paperCount === 0) continue;
    let along = 0;
    let length = 0;
    const under = beside.map((sum) => sum / paperCount);
    for (let c = 0; c < 3; c += 1) {
      const toward = inner[c]! / solid - under[c]!;
      along += (data[at + c]! - under[c]!) * toward;
      length += toward * toward;
    }
    const alpha = length === 0 ? 1 : Math.max(0, Math.min(1, along / length));
    if (alpha >= 1) continue;
    if (alpha <= 0) {
      out[at + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c += 1) {
      out[at + c] = Math.max(0, Math.min(255, Math.round((data[at + c]! - (1 - alpha) * under[c]!) / alpha)));
    }
    out[at + 3] = Math.round(alpha * data[at + 3]!);
  }
  return { width, height, data: out };
}

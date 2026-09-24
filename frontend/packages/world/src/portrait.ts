/**
 * A placeholder portrait: a cut-paper silhouette of a sitter in profile, the portrait fashion of the 1790s.
 *
 * Plainly a placeholder. The portraits a player sees are Adam's own art, saved over these in
 * `world/portraits/`, and until he has drawn them this is what stands in: one ink shape on a card, drawn
 * from a seed so that the same sitter is the same shape on every machine. See decision record 0055 and
 * `docs/plans/characters-and-key-figures.md`.
 */

import type { RgbImage } from './png.ts';

/** Whom a portrait suits, which is the first word of its file's name. */
export type Sitter = 'woman' | 'man';

/** Three wide by four tall, and large enough for a phone's big bay at twice its pixel density. */
export const PORTRAIT_WIDTH = 768;
export const PORTRAIT_HEIGHT = 1024;

type Point = readonly [number, number];

/** A small seeded random: the same seed gives the same sitter, and nothing here reaches for a clock. */
function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth closed curve through the points, as a polygon: Catmull-Rom, a few steps a span. */
function smooth(points: readonly Point[], steps = 8): Point[] {
  const out: Point[] = [];
  const count = points.length;
  for (let index = 0; index < count; index += 1) {
    const p0 = points[(index - 1 + count) % count]!;
    const p1 = points[index]!;
    const p2 = points[(index + 1) % count]!;
    const p3 = points[(index + 2) % count]!;
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const along = (a: number, b: number, c: number, d: number): number =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([along(p0[0], p1[0], p2[0], p3[0]), along(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, steps = 48): Point[] {
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as const;
  });
}

/**
 * The outline of a sitter facing right, in the unit square of the card (x across, y down), before any
 * hair or dress: crown, forehead, nose, lips, chin, neck, the front of the chest, the bottom edge, the back
 * of the shoulders and the back of the head. `vary` is how far each feature strays from the plain one.
 */
function profile(sitter: Sitter, vary: (spread: number) => number): Point[] {
  const nose = [vary(0.018) + 0.004, vary(0.01)] as const;
  const brow = vary(0.012);
  const lips = vary(0.006);
  const chin = vary(0.015);
  // A woman's neck is drawn slimmer and her chest fuller, the way the cut-paper portraits of the time did.
  const neck = (sitter === 'woman' ? 0.012 : -0.004) + vary(0.008);
  const chest = (sitter === 'woman' ? 0.03 : 0) + vary(0.015);

  return [
    [0.46, 0.13],
    [0.56, 0.145],
    [0.625 + brow, 0.19],
    [0.655 + brow, 0.25],
    [0.662 + brow, 0.3],
    [0.655, 0.322],
    [0.69 + nose[0] * 0.6, 0.37 + nose[1]],
    [0.712 + nose[0], 0.398 + nose[1]],
    [0.69 + nose[0] * 0.4, 0.41],
    [0.672, 0.418],
    [0.68 + lips, 0.438],
    [0.668, 0.45],
    [0.676 + lips, 0.462],
    [0.66 + chin * 0.5, 0.478],
    [0.668 + chin, 0.505],
    [0.645 + chin * 0.5, 0.53],
    [0.61, 0.545],
    [0.6 + neck, 0.6],
    [0.6 + neck, 0.65],
    [0.66 + chest * 0.5, 0.7],
    [0.76 + chest, 0.76],
    [0.85 + chest * 0.5, 0.85],
    [0.9, 1.02],
    [0.08, 1.02],
    [0.12, 0.86],
    [0.22, 0.76],
    [0.36 - neck, 0.7],
    [0.4 - neck, 0.63],
    [0.38, 0.54],
    [0.33, 0.45],
    [0.31, 0.34],
    [0.34, 0.23],
    [0.39, 0.165],
  ];
}

/** Hair and dress, the other shapes cut from the same paper: they only ever add to the outline. */
function adornments(sitter: Sitter, style: number, vary: (spread: number) => number): Point[][] {
  if (sitter === 'woman') {
    switch (style % 3) {
      case 0:
        // Hair gathered into a knot at the back of the head.
        return [ellipse(0.33 + vary(0.015), 0.2 + vary(0.015), 0.085 + vary(0.01), 0.08 + vary(0.01))];
      case 1:
        // A soft cap over the crown, gathered at the back.
        return [ellipse(0.42 + vary(0.01), 0.17, 0.17 + vary(0.01), 0.095 + vary(0.01))];
      default:
        // A ribbon's knot at the back, and curls falling to the nape.
        return [
          ellipse(0.36, 0.2, 0.05, 0.045),
          ellipse(0.34 + vary(0.01), 0.47, 0.045, 0.06),
          ellipse(0.36 + vary(0.01), 0.54, 0.04, 0.05),
        ];
    }
  }
  const queue: Point[] = [
    [0.37, 0.46],
    [0.345, 0.455],
    [0.27 + vary(0.015), 0.63],
    [0.305 + vary(0.015), 0.64],
  ];
  const bow: Point[] = [
    [0.335, 0.53],
    [0.28, 0.5 + vary(0.01)],
    [0.29, 0.57],
    [0.335, 0.545],
    [0.39, 0.575],
    [0.385, 0.5 + vary(0.01)],
  ];
  // A stock or cravat at the throat, and the collar of the coat standing up behind the neck.
  const cravat = ellipse(0.598 + vary(0.004), 0.625, 0.036, 0.04);
  const collar: Point[] = [
    [0.35, 0.63],
    [0.44, 0.6],
    [0.47, 0.71],
    [0.33, 0.73],
  ];
  const shapes = [queue, bow, cravat, collar];
  if (style % 2 === 1) {
    // The rolled curl of a wig, over the ear.
    shapes.push(ellipse(0.335, 0.39 + vary(0.01), 0.045, 0.035));
  }
  return shapes;
}

/**
 * Every shape filled into a coverage mask, supersampled so the edges are soft: the even-odd rule within a
 * shape, and the shapes laid over one another.
 */
function coverage(
  shapes: readonly (readonly Point[])[],
  width: number,
  height: number,
  fineness = 3,
): Float32Array {
  const fineWidth = width * fineness;
  const fineHeight = height * fineness;
  const fine = new Uint8Array(fineWidth * fineHeight);
  const crossings: number[] = [];
  for (const shape of shapes) {
    const scaled = shape.map(([x, y]) => [x * fineWidth, y * fineHeight] as const);
    for (let row = 0; row < fineHeight; row += 1) {
      const y = row + 0.5;
      crossings.length = 0;
      for (let index = 0; index < scaled.length; index += 1) {
        const [ax, ay] = scaled[index]!;
        const [bx, by] = scaled[(index + 1) % scaled.length]!;
        if (ay <= y !== by <= y) {
          crossings.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
        const from = Math.max(0, Math.ceil(crossings[pair]! - 0.5));
        const to = Math.min(fineWidth - 1, Math.floor(crossings[pair + 1]! - 0.5));
        fine.fill(1, row * fineWidth + from, row * fineWidth + to + 1);
      }
    }
  }

  const out = new Float32Array(width * height);
  const samples = fineness * fineness;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      let covered = 0;
      for (let dy = 0; dy < fineness; dy += 1) {
        const at = (row * fineness + dy) * fineWidth + column * fineness;
        for (let dx = 0; dx < fineness; dx += 1) {
          covered += fine[at + dx]!;
        }
      }
      out[row * width + column] = covered / samples;
    }
  }
  return out;
}

/**
 * One placeholder portrait: the sitter's silhouette in ink on a card, with the card a little darker towards
 * its edges. Every other seed faces the other way, so a grid of them does not look like a queue.
 */
export function drawSilhouette(
  sitter: Sitter,
  seed: number,
  width = PORTRAIT_WIDTH,
  height = PORTRAIT_HEIGHT,
): RgbImage {
  const random = randomFrom(seed * 7919 + (sitter === 'woman' ? 17 : 29));
  const vary = (spread: number): number => (random() * 2 - 1) * spread;
  const facingLeft = seed % 2 === 0;

  const outline = smooth(profile(sitter, vary));
  const shapes = [outline, ...adornments(sitter, seed, vary).map((shape) => smooth(shape, 4))].map((shape) =>
    facingLeft ? shape.map(([x, y]) => [1 - x, y] as const) : shape,
  );
  const ink = coverage(shapes, width, height);

  // The card, warm and a touch different from one sitter to the next, and the ink cut from black paper.
  const card = [236 + vary(4), 227 + vary(5), 206 + vary(6)] as const;
  const black = [30, 26, 23] as const;
  const pixels = new Uint8Array(width * height * 3);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const dx = column / width - 0.5;
      const dy = row / height - 0.45;
      const shade = 1 - 0.1 * Math.min(1, (dx * dx + dy * dy) * 3.2);
      const cover = ink[row * width + column]!;
      const at = (row * width + column) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        const paper = card[channel]! * shade;
        pixels[at + channel] = Math.round(paper + (black[channel]! - paper) * cover);
      }
    }
  }
  return { width, height, pixels };
}

/** How deep a frame is, where its words start, its file of cuts, and a fill from its middle. */

import type { BorderFile, Repeat, Rgba, Sides } from '../border.ts';
import { spanLength } from './tiles.ts';
import type { Span } from './tiles.ts';

/** What share of a side's places a fill's edge is set by, the shallowest: a crack in a moulding is not it. */
const SHALLOW = 0.05;

/**
 * How deep the frame is on each side: from the picture's edge to the first clear pixel past the frame, at
 * every place along that side, corners and all, and of those nearly the shallowest - the moulding, rather
 * than a cloud, a ray or a corner's ornament standing in from it. A fill begins just short of it, so no gap
 * shows between the moulding and the fill wherever an ornament does not stand in front of it.
 */
export function innerDepths(image: Rgba, slice: Sides): Sides {
  const { width, height, data } = image;
  const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3]!;
  const depth = (length: number, at: (step: number) => number) => {
    let seen = false;
    for (let step = 0; step < length; step += 1) {
      if (at(step) > 128) {
        seen = true;
      } else if (seen) {
        return step;
      }
    }
    return 0;
  };
  const shallowest = (from: number, to: number, along: (place: number) => number): number => {
    const depths: number[] = [];
    for (let place = from; place < to; place += 1) {
      const one = along(place);
      if (one > 0) depths.push(one);
    }
    depths.sort((a, b) => a - b);
    return depths[Math.floor((depths.length - 1) * SHALLOW)] ?? 0;
  };
  // Past a slice, a depth is not a side's but the box's, so it is no measure of the moulding.
  const within = (side: number) => (one: number) => (one <= slice[side]! ? one : 0);
  return [
    shallowest(0, width, (x) => within(0)(depth(height, (step) => alpha(x, step)))),
    shallowest(0, height, (y) => within(1)(depth(width, (step) => alpha(width - 1 - step, y)))),
    shallowest(0, width, (x) => within(2)(depth(height, (step) => alpha(x, height - 1 - step)))),
    shallowest(0, height, (y) => within(3)(depth(width, (step) => alpha(step, y)))),
  ];
}

/**
 * Where a frame's words can start, in from each edge of the box, whatever its cuts are: past the deepest
 * reach of each edge - a column's ring and not only its shaft, because an edge is laid along the box again
 * and again - and clear of each corner's ornament, by moving in whichever of the corner's two sides costs
 * the words less room; then `margin` more. A frame with deep corners and thin edges starts its words
 * inside its cuts.
 */
export function contentOf(image: Rgba, slice: Sides, margin: number): Sides {
  const { width, height, data } = image;
  const opaque = (x: number, y: number) => data[(y * width + x) * 4 + 3]! > 128;
  // In from a side, at a place along it: the picture's own x and y.
  const at = (side: number, along: number, inward: number): [number, number] =>
    side === 0
      ? [along, inward]
      : side === 1
        ? [width - 1 - inward, along]
        : side === 2
          ? [along, height - 1 - inward]
          : [inward, along];
  const deepest = (side: number): number => {
    const across = side === 0 || side === 2;
    const from = across ? slice[3] : slice[0];
    const to = across ? width - slice[1] : height - slice[2];
    let deep = 0;
    for (let along = from; along < to; along += 1) {
      for (let inward = slice[side]! - 1; inward >= deep; inward -= 1) {
        if (opaque(...at(side, along, inward))) {
          deep = inward + 1;
          break;
        }
      }
    }
    return deep;
  };
  const edges: Sides = [deepest(0), deepest(1), deepest(2), deepest(3)];
  const need = [...edges];
  // The corners, each as the side above or below it and the side beside it. For every depth the words
  // could start at, how far across they would have to start to clear what stands in the corner at that
  // depth and past it - which only grows, going out from the middle - and of those, the one that costs
  // the words least, across and down together.
  for (const [down, across] of [
    [0, 3],
    [0, 1],
    [2, 1],
    [2, 3],
  ] as const) {
    const from = edges[down]!;
    const to = slice[down]!;
    const start = edges[across]!;
    let best = { down: to, across: start, cost: to - from };
    let reach = start;
    for (let inDown = to - 1; inDown >= from; inDown -= 1) {
      const y = down === 0 ? inDown : height - 1 - inDown;
      for (let inAcross = slice[across]! - 1; inAcross >= reach; inAcross -= 1) {
        if (opaque(across === 3 ? inAcross : width - 1 - inAcross, y)) {
          reach = inAcross + 1;
          break;
        }
      }
      const cost = reach - start + (inDown - from);
      if (cost <= best.cost) {
        best = { down: inDown, across: reach, cost };
      }
    }
    need[down] = Math.max(need[down]!, best.down);
    need[across] = Math.max(need[across]!, best.across);
  }
  return [need[0]! + margin, need[1]! + margin, need[2]! + margin, need[3]! + margin];
}

/** How far past the frame's inner edge a fill reaches under it. */
const UNDER = 4;

/**
 * A border's file for the joined frame: its cuts where the tiles met, where its words start, and a fill
 * reaching under it.
 */
export function borderFileFor(
  slice: Sides,
  depths: Sides,
  repeat: Repeat,
  content: Sides,
  middle = false,
): BorderFile {
  if (middle) {
    return { slice, repeat, content, middle };
  }
  const under = (side: number) => Math.max(0, Math.min(slice[side]!, slice[side]! - depths[side]! + UNDER));
  return { slice, repeat, content, fillUnder: [under(0), under(1), under(2), under(3)] };
}

/**
 * A fill made from the middle tile: squared, and laid with its mirror images into a square twice its
 * size, so that every edge meets its own reflection and it repeats without a seam. Opaque.
 */
export function mirroredSquare(image: Rgba, column: Span, row: Span): Rgba {
  const side = Math.min(spanLength(column), spanLength(row));
  const width = side * 2;
  const data = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = column[0] + (x < side ? x : width - 1 - x);
      const sy = row[0] + (y < side ? y : width - 1 - y);
      const from = (sy * image.width + sx) * 4;
      const to = (y * width + x) * 4;
      data[to] = image.data[from]!;
      data[to + 1] = image.data[from + 1]!;
      data[to + 2] = image.data[from + 2]!;
      data[to + 3] = 255;
    }
  }
  return { width, height: width, data };
}

/**
 * A border's file for its picture made `factor` times the size: every length scaled with it, and no cut
 * smaller than a pixel. The game shows a border at a quarter of its pixels, so this is how thick it looks.
 */
export function scaledFile(file: BorderFile, factor: number): BorderFile {
  const scale = (sides: Sides, least: number): Sides => [
    Math.max(least, Math.round(sides[0] * factor)),
    Math.max(least, Math.round(sides[1] * factor)),
    Math.max(least, Math.round(sides[2] * factor)),
    Math.max(least, Math.round(sides[3] * factor)),
  ];
  return {
    ...file,
    slice: scale(file.slice, 1),
    ...(file.inset === undefined ? {} : { inset: scale(file.inset, 0) }),
    ...(file.content === undefined ? {} : { content: scale(file.content, 0) }),
    ...(file.outset === undefined ? {} : { outset: scale(file.outset, 0) }),
    ...(file.fillUnder === undefined ? {} : { fillUnder: scale(file.fillUnder, 0) }),
  };
}

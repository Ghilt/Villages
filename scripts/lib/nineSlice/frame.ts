/** The frame kept and what it stood on cleared, how deep it is, where its words start, and a fill from its middle. */

import type { BorderFile, Repeat, Rgba, Sides } from '../border.ts';
import { spanLength } from './tiles.ts';
import type { Span } from './tiles.ts';

/**
 * How a frame is told from what it stands on. `alpha`: the picture is clear round it already. `none`: it
 * stands on nothing, the frame runs to the picture's edge, and all of it is kept. `checker`: it stands on
 * the grey and white checks an image model paints to mean transparent, which are light and have no colour.
 * `warmth`: a gilt frame is warm - its red well above its blue, even in its darkest groove - and the stone,
 * the black and the white it stands on are not, so whatever is cooler than this is what it stands on.
 */
export type Background = 'alpha' | 'none' | 'checker' | { readonly warmth: number };

/** A check of a painted checkerboard: light, and its three channels within this of each other. */
const CHECK_LIGHT = 170;
const CHECK_SPREAD = 8;
const isCheck = (data: Uint8Array, at: number) =>
  Math.min(data[at]!, data[at + 1]!, data[at + 2]!) >= CHECK_LIGHT &&
  Math.max(data[at]!, data[at + 1]!, data[at + 2]!) - Math.min(data[at]!, data[at + 1]!, data[at + 2]!) <=
    CHECK_SPREAD;

/** Whether a picture's outer edge is nearly all checks: what a frame on a painted checkerboard looks like. */
export function standsOnChecks(image: Rgba): boolean {
  const { width, height, data } = image;
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.01));
  let checks = 0;
  let all = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= band && x < width - band && y >= band && y < height - band) {
        continue;
      }
      all += 1;
      checks += isCheck(data, (y * width + x) * 4) ? 1 : 0;
    }
  }
  return checks / all >= 0.9;
}

/** Whether a picture is clear round its frame: a hundredth of it or more is nearly transparent. */
export function isClearRound(image: Rgba): boolean {
  let clear = 0;
  for (let at = 3; at < image.data.length; at += 4) clear += image.data[at]! < 16 ? 1 : 0;
  return clear / (image.width * image.height) >= 0.01;
}

/** The picture made opaque: for one whose transparency is not its background, but a slip in saving it. */
export function opaque(image: Rgba): Rgba {
  const data = new Uint8Array(image.data);
  for (let at = 3; at < data.length; at += 4) data[at] = 255;
  return { width: image.width, height: image.height, data };
}

const warmthAt = (data: Uint8Array, at: number) => data[at]! - data[at + 2]!;

/** A piece left standing that is less than this share of the largest is a speck of what it stood on. */
const ISLAND = 0.02;

/**
 * Clears what is left standing on its own: a warmer fleck of the stone, cut off from both floods, which is
 * no part of the frame. The frame is one piece, its mouldings and its ornaments joined, so anything much
 * smaller than the largest piece goes. `reached` marks what is cleared, and gains the islands.
 */
function clearIslands(reached: Uint8Array, width: number, height: number): void {
  const piece = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  const queue: number[] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (reached[start] || piece[start] !== -1) {
      continue;
    }
    const label = sizes.length;
    piece[start] = label;
    queue.length = 0;
    queue.push(start);
    for (let head = 0; head < queue.length; head += 1) {
      const pixel = queue[head]!;
      const x = pixel % width;
      const y = (pixel - x) / width;
      const visit = (next: number) => {
        if (!reached[next] && piece[next] === -1) {
          piece[next] = label;
          queue.push(next);
        }
      };
      if (x > 0) visit(pixel - 1);
      if (x < width - 1) visit(pixel + 1);
      if (y > 0) visit(pixel - width);
      if (y < height - 1) visit(pixel + width);
    }
    sizes.push(queue.length);
  }
  const largest = Math.max(0, ...sizes);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const label = piece[pixel]!;
    if (label >= 0 && sizes[label]! < largest * ISLAND) {
      reached[pixel] = 1;
    }
  }
}

/**
 * Takes away what the frame stands on, outside it and inside it: whatever the picture's edge or its
 * middle can reach through background is cleared, with a soft edge where it meets the frame. A dark
 * crevice inside the frame that neither can reach is kept, because it is the frame's own shadow.
 */
export function clearBackground(image: Rgba, background: Background, fromMiddle = true): Rgba {
  if (background === 'alpha' || background === 'none') {
    return image;
  }
  const { width, height, data } = image;
  const checker = background === 'checker';
  const below = checker ? 0 : background.warmth;
  const behind = (pixel: number) =>
    data[pixel * 4 + 3]! < 128 || (checker ? isCheck(data, pixel * 4) : warmthAt(data, pixel * 4) < below);
  const reached = new Uint8Array(width * height);
  const queue: number[] = [];
  const seed = (pixel: number) => {
    if (!reached[pixel] && behind(pixel)) {
      reached[pixel] = 1;
      queue.push(pixel);
    }
  };
  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  if (fromMiddle) {
    seed(Math.floor(height / 2) * width + Math.floor(width / 2));
  }
  for (let head = 0; head < queue.length; head += 1) {
    const pixel = queue[head]!;
    const x = pixel % width;
    const y = (pixel - x) / width;
    if (x > 0) seed(pixel - 1);
    if (x < width - 1) seed(pixel + 1);
    if (y > 0) seed(pixel - width);
    if (y < height - 1) seed(pixel + width);
  }
  clearIslands(reached, width, height);
  const out = new Uint8Array(data);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (!reached[pixel]) {
      continue;
    }
    const x = pixel % width;
    const y = (pixel - x) / width;
    let besideFrame = false;
    for (let dy = -1; dy <= 1 && !besideFrame; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !reached[ny * width + nx]) {
          besideFrame = true;
          break;
        }
      }
    }
    // Beside the frame, as much of it as its warmth says, so the edge is soft; anywhere else, nothing.
    const share = !besideFrame
      ? 0
      : checker
        ? 0.5
        : Math.max(0, Math.min(1, (warmthAt(data, pixel * 4) - (below - 10)) / 10));
    out[pixel * 4 + 3] = Math.round(data[pixel * 4 + 3]! * share);
  }
  return { width, height, data: out };
}

/**
 * How deep the frame is on each side, half way along that side's edge: from the picture's edge to the
 * first clear pixel past the frame. A fill begins just short of it, so no gap shows under an uneven edge.
 */
export function innerDepths(image: Rgba, slice: Sides): Sides {
  const { width, height, data } = image;
  const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3]!;
  const middleX = slice[3] + Math.round((width - slice[1] - slice[3]) / 2);
  const middleY = slice[0] + Math.round((height - slice[0] - slice[2]) / 2);
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
  return [
    depth(height, (step) => alpha(middleX, step)),
    depth(width, (step) => alpha(width - 1 - step, middleY)),
    depth(height, (step) => alpha(middleX, height - 1 - step)),
    depth(width, (step) => alpha(step, middleY)),
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

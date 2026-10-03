/** What a frame stands on, told apart from it and cleared, outside it and inside it. */

import type { Rgba } from '../border.ts';

/**
 * How a frame is told from what it stands on. `alpha`: the picture is clear round it already, and what is
 * nearly clear is cleared outright. `none`: it stands on nothing, the frame runs to the picture's edge, and
 * all of it is kept. `checker`: it stands on the grey and white checks an image model paints to mean
 * transparent, which are light and have no colour. `warmth`: a gilt frame is warm - its red well above its
 * blue, even in its darkest groove - and the stone, the black and the white it stands on are not, so
 * whatever is cooler than this is what it stands on; with `darker`, only what is also darker than that, so
 * that pale clouds as cool as the night sky round them are kept as part of the frame.
 */
export type Background = 'alpha' | 'none' | 'checker' | { readonly warmth: number; readonly darker?: number };

/** A background as the tool says it and a recipe writes it on the command line: `alpha`, `30`, `30,dark:110`. */
export function backgroundText(background: Background): string {
  if (typeof background === 'string') return background;
  return background.darker === undefined
    ? `warmth ${background.warmth}`
    : `warmth ${background.warmth}, darker than ${background.darker}`;
}

const warmthAt = (data: Uint8Array, at: number) => data[at]! - data[at + 2]!;

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

/** Less opaque than this is nearly clear: a slip of the brush or of the saving, seen by nobody but a fill. */
const NEARLY_CLEAR = 16;

/** What a dark, cool ground is told from a gilt frame by: cooler than this, and darker than that. */
export const DARK_GROUND = { warmth: 30, darker: 110 } as const;

/**
 * Whether a picture stands on a dark, cool ground: the middle colour of its outer edge is darker and cooler
 * than `DARK_GROUND`. A frame painted on a night sky or on black stone, which keeps its ground unless told.
 */
export function standsOnDarkGround(image: Rgba): boolean {
  const { width, height, data } = image;
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.01));
  const warmths: number[] = [];
  const lights: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= band && x < width - band && y >= band && y < height - band) {
        continue;
      }
      const at = (y * width + x) * 4;
      warmths.push(warmthAt(data, at));
      lights.push(Math.max(data[at]!, data[at + 1]!, data[at + 2]!));
    }
  }
  const middle = (all: number[]) => all.sort((a, b) => a - b)[Math.floor(all.length / 2)]!;
  return middle(warmths) < DARK_GROUND.warmth && middle(lights) < DARK_GROUND.darker;
}

/** Whether a picture is clear round its frame: a hundredth of it or more is nearly transparent. */
export function isClearRound(image: Rgba): boolean {
  let clear = 0;
  for (let at = 3; at < image.data.length; at += 4) clear += image.data[at]! < NEARLY_CLEAR ? 1 : 0;
  return clear / (image.width * image.height) >= 0.01;
}

/** The picture made opaque: for one whose transparency is not its background, but a slip in saving it. */
export function opaque(image: Rgba): Rgba {
  const data = new Uint8Array(image.data);
  for (let at = 3; at < data.length; at += 4) data[at] = 255;
  return { width: image.width, height: image.height, data };
}

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

/** The picture with what is nearly clear made clear: the faint film a saving leaves where nothing is painted. */
function clearOfSlips(image: Rgba): Rgba {
  const data = new Uint8Array(image.data);
  for (let at = 3; at < data.length; at += 4) if (data[at]! < NEARLY_CLEAR) data[at] = 0;
  return { width: image.width, height: image.height, data };
}

/**
 * Takes away what the frame stands on, outside it and inside it: whatever the picture's edge or its
 * middle can reach through background is cleared, with a soft edge where it meets the frame. A dark
 * crevice inside the frame that neither can reach is kept, because it is the frame's own shadow.
 */
export function clearBackground(image: Rgba, background: Background, fromMiddle = true): Rgba {
  if (background === 'none') {
    return image;
  }
  if (background === 'alpha') {
    return clearOfSlips(image);
  }
  const { width, height, data } = image;
  const checker = background === 'checker';
  const below = checker ? 0 : background.warmth;
  const darker = checker ? 256 : (background.darker ?? 256);
  const dark = (at: number) => Math.max(data[at]!, data[at + 1]!, data[at + 2]!) < darker;
  const behind = (pixel: number) =>
    data[pixel * 4 + 3]! < 128 ||
    (checker ? isCheck(data, pixel * 4) : warmthAt(data, pixel * 4) < below && dark(pixel * 4));
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

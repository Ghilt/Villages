import type { Rgba } from './art.ts';

/**
 * A medallion's window: where its frame is clear inside itself, which is where the picture it holds shows
 * through. Found from the picture rather than said in a file of its own - whatever is clear and shut in by
 * the frame, reached from no edge of the picture, is window, and the largest of it is the one - so a frame
 * painted with a clear middle is a medallion that holds a portrait, and one painted whole, the compass or a
 * shield, is an emblem. And the hole a placeholder's window is punched as, out of a piece of the moodboard
 * that has a portrait painted where its window should be. See docs/AUTHORING-THE-ART.md.
 */

/** Where a window is, as shares of the whole picture: from its left and its top, and how wide and tall. */
export interface UiWindow {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** An ellipse, in a picture's own pixels: its middle and how far it reaches across and down. */
export interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

/** How clear a pixel has to be to be window rather than frame. */
const CLEAR = 128;

/** The least of the picture a window takes, so that a gap between two curls is not taken for one. */
export const LEAST_WINDOW = 0.02;

/** The window in a picture, or null for one that has none: an emblem. */
export function windowOf(image: Rgba): UiWindow | null {
  const { width, height, data } = image;
  const clear = (pixel: number) => data[pixel * 4 + 3]! < CLEAR;
  // 1 for the room round the picture, reached from an edge; 2 for a hole already measured.
  const seen = new Uint8Array(width * height);
  const outside: number[] = [];
  for (let x = 0; x < width; x += 1) {
    outside.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    outside.push(y * width, y * width + width - 1);
  }
  const room = outside.filter((pixel) => clear(pixel) && seen[pixel] === 0);
  for (const pixel of room) {
    seen[pixel] = 1;
  }
  floodFrom(room, seen, 1, width, height, clear);

  let best: { size: number; left: number; top: number; right: number; bottom: number } | null = null;
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] !== 0 || !clear(start)) {
      continue;
    }
    seen[start] = 2;
    const hole = floodFrom([start], seen, 2, width, height, clear);
    if (best === null || hole.size > best.size) {
      best = hole;
    }
  }
  if (best === null || best.size < width * height * LEAST_WINDOW) {
    return null;
  }
  return {
    left: best.left / width,
    top: best.top / height,
    width: (best.right - best.left + 1) / width,
    height: (best.bottom - best.top + 1) / height,
  };
}

/** Marks every clear pixel joined to `from` as `mark`, and says how many there were and where they reach. */
function floodFrom(
  from: number[],
  seen: Uint8Array,
  mark: number,
  width: number,
  height: number,
  clear: (pixel: number) => boolean,
): { size: number; left: number; top: number; right: number; bottom: number } {
  const stack = [...from];
  let size = 0;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  while (stack.length > 0) {
    const pixel = stack.pop()!;
    const x = pixel % width;
    const y = (pixel - x) / width;
    size += 1;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const next = ny * width + nx;
      if (seen[next] === 0 && clear(next)) {
        seen[next] = mark;
        stack.push(next);
      }
    }
  }
  return { size, left, top, right, bottom };
}

/** The picture with an ellipse made clear, its edge softened over a pixel so that the hole is not jagged. */
export function punchedOf(image: Rgba, hole: Ellipse): Rgba {
  const { width, height } = image;
  const data = new Uint8Array(image.data);
  const reach = Math.min(hole.rx, hole.ry);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const across = (x + 0.5 - hole.cx) / hole.rx;
      const down = (y + 0.5 - hole.cy) / hole.ry;
      // How far outside the edge this pixel is, in pixels, roughly: below nought it is inside.
      const outside = (Math.sqrt(across * across + down * down) - 1) * reach;
      const kept = Math.min(1, Math.max(0, outside + 0.5));
      const alpha = (y * width + x) * 4 + 3;
      data[alpha] = Math.round(data[alpha]! * kept);
    }
  }
  return { width, height, data };
}

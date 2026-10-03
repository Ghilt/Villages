/**
 * Where to cut a picture of a frame that has no plain white or black gaps between its tiles: one whose
 * tiles are parted by a thin line or an engraved groove, and one painted whole, with no lines at all,
 * whose edges repeat between its corners.
 */

import type { Rgba, Sides } from '../border.ts';
import type { Span } from './tiles.ts';

const brightnessOf = (image: Rgba): Float32Array => {
  const out = new Float32Array(image.width * image.height);
  for (let pixel = 0; pixel < out.length; pixel += 1) {
    const at = pixel * 4;
    out[pixel] = (image.data[at]! + image.data[at + 1]! + image.data[at + 2]!) / 3;
  }
  return out;
};

/** How far either side a line is compared against, to tell a line from the picture round it. */
const LINE_BASELINE = 4;
/** How much lighter, or darker, than both sides a pixel of a line is. */
const LINE_CONTRAST = 10;
/** A line between tiles is lighter or darker than both sides over at least this share of its length. */
const LINE_SHARE = 0.75;
/** Its neighbours that are part of it: this share of its own, and no further than this from it. */
const LINE_WIDTH_SHARE = 0.4;
const LINE_WIDEST = 4;
/** How far in from the picture's edge a line between tiles is looked for: past the frame's own mouldings. */
const LINE_MARGIN = 0.08;

/**
 * The two lines between the tiles each way, when they are not the plain white or black gaps `gapsIn`
 * finds: a thin, soft line, or an engraved groove, a dark line beside a light one. A line between tiles
 * runs the whole length of the picture, across the corners, the edges and the middle alike, and each of
 * its pixels is lighter or darker than both its neighbours a few pixels away - which a frame's mouldings,
 * stopping at the corners, and a column's edge, light on one side and dark on the other, are not. One is
 * looked for on each side of the middle. Null when either is missing, so a frame painted whole falls
 * through to its edges.
 */
export function linesIn(image: Rgba): { columns: Span[]; rows: Span[] } | null {
  const light = brightnessOf(image);
  const find = (axis: 'columns' | 'rows'): Span[] | null => {
    const lines = axis === 'columns' ? image.width : image.height;
    const length = axis === 'columns' ? image.height : image.width;
    const at = (line: number, along: number) =>
      axis === 'columns' ? light[along * image.width + line]! : light[line * image.width + along]!;
    const share = new Float32Array(lines);
    for (let line = LINE_BASELINE; line < lines - LINE_BASELINE; line += 1) {
      let ridge = 0;
      for (let along = 0; along < length; along += 1) {
        const here = at(line, along);
        const before = here - at(line - LINE_BASELINE, along);
        const after = here - at(line + LINE_BASELINE, along);
        ridge +=
          (before > LINE_CONTRAST && after > LINE_CONTRAST) ||
          (before < -LINE_CONTRAST && after < -LINE_CONTRAST)
            ? 1
            : 0;
      }
      share[line] = ridge / length;
    }
    const strongest = (from: number, to: number): Span | null => {
      let peak = from;
      for (let line = from; line < to; line += 1) {
        if (share[line]! > share[peak]!) peak = line;
      }
      if (share[peak]! < LINE_SHARE) {
        return null;
      }
      const part = (line: number) => share[line]! >= LINE_WIDTH_SHARE * share[peak]!;
      let first = peak;
      while (first > 0 && peak - first < LINE_WIDEST && part(first - 1)) first -= 1;
      let last = peak;
      while (last < lines - 1 && last - peak < LINE_WIDEST && part(last + 1)) last += 1;
      // And a pixel either side, the soft edge a line leaves on the tiles beside it.
      return [Math.max(0, first - 1), Math.min(lines - 1, last + 1)];
    };
    const middle = Math.floor(lines / 2);
    const one = strongest(Math.floor(lines * LINE_MARGIN), middle);
    const two = strongest(middle, Math.ceil(lines * (1 - LINE_MARGIN)));
    return one === null || two === null ? null : [one, two];
  };
  const columns = find('columns');
  const rows = find('rows');
  return columns === null || rows === null ? null : { columns, rows };
}

/** How much more unlike the middle of its edge than the middle itself a stretch of corner is, at least. */
const CORNER_RISE = 0.1;
/** The least an edge can repeat over, as a share of its side, before it is not believed. */
const SHORTEST_EDGE = 0.15;

/**
 * Where an edge stops repeating, along one side: the band a quarter of the picture deep along that side,
 * each line across it compared with the line at the middle of the side. Along the stretch an edge repeats
 * or stretches over, the lines are alike; in a corner's ornament they are not. Returns the first and last
 * place along the side that is still edge, or null when no corner stands out from it.
 */
function edgeAlong(image: Rgba, side: 0 | 1 | 2 | 3): Span | null {
  const { width, height, data } = image;
  const across = side === 0 || side === 2;
  const length = across ? width : height;
  const depth = Math.floor(Math.min(width, height) / 4);
  const pixel = (along: number, inward: number) => {
    const x = across ? along : side === 3 ? inward : width - 1 - inward;
    const y = across ? (side === 0 ? inward : height - 1 - inward) : along;
    return (y * width + x) * 4;
  };
  const middle = Math.floor(length / 2);
  const profile = new Float32Array(depth * 3);
  for (let inward = 0; inward < depth; inward += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      let sum = 0;
      for (let along = middle - 2; along <= middle + 2; along += 1) {
        const at = pixel(along, inward);
        sum += (data[at + channel]! * data[at + 3]!) / 255;
      }
      profile[inward * 3 + channel] = sum / 5;
    }
  }
  const unlike = new Float32Array(length);
  for (let along = 0; along < length; along += 1) {
    let sum = 0;
    for (let inward = 0; inward < depth; inward += 1) {
      const at = pixel(along, inward);
      for (let channel = 0; channel < 3; channel += 1) {
        sum += Math.abs((data[at + channel]! * data[at + 3]!) / 255 - profile[inward * 3 + channel]!);
      }
    }
    unlike[along] = sum / (depth * 3);
  }
  const smooth = new Float32Array(length);
  for (let along = 0; along < length; along += 1) {
    let sum = 0;
    let count = 0;
    for (let near = Math.max(0, along - 4); near <= Math.min(length - 1, along + 4); near += 1) {
      sum += unlike[near]!;
      count += 1;
    }
    smooth[along] = sum / count;
  }
  const inMiddle = [...smooth.subarray(Math.floor(length * 0.4), Math.ceil(length * 0.6))].sort(
    (a, b) => a - b,
  );
  const base = inMiddle[Math.floor(inMiddle.length / 2)]!;
  const peak = Math.max(
    ...smooth.subarray(0, Math.floor(length * 0.3)),
    ...smooth.subarray(Math.ceil(length * 0.7)),
  );
  if (peak - base < 10) {
    return null;
  }
  const threshold = base + CORNER_RISE * (peak - base);
  let first = middle;
  while (first > 0 && smooth[first - 1]! < threshold) first -= 1;
  let last = middle;
  while (last < length - 1 && smooth[last + 1]! < threshold) last += 1;
  return last - first + 1 < length * SHORTEST_EDGE ? null : [first, last];
}

/**
 * The cuts of a frame painted whole, with no lines between tiles: each corner reaches as far as the
 * further of the two corners on that side of it, so that both its ornaments are in it. Null when an edge
 * cannot be told from its corners, for the cuts to be given instead.
 */
export function cutsFromEdges(image: Rgba): Sides | null {
  const edges = ([0, 1, 2, 3] as const).map((side) => edgeAlong(image, side));
  if (edges.some((edge) => edge === null)) {
    return null;
  }
  const [top, right, bottom, left] = edges as Span[];
  return [
    Math.max(left![0], right![0]),
    image.width - 1 - Math.min(top![1], bottom![1]),
    image.height - 1 - Math.min(left![1], right![1]),
    Math.max(top![0], bottom![0]),
  ];
}

/** The nine tiles of a picture cut at `cuts`, top, right, bottom and left, with nothing between them. */
export function tilesAt(
  cuts: Sides,
  width: number,
  height: number,
): { columns: [Span, Span, Span]; rows: [Span, Span, Span] } {
  const [top, right, bottom, left] = cuts;
  if (
    left + right >= width ||
    top + bottom >= height ||
    cuts.some((cut) => !Number.isInteger(cut) || cut < 1)
  ) {
    throw new Error(`cuts of ${cuts.join(', ')} do not fit a picture ${width} by ${height}`);
  }
  return {
    columns: [
      [0, left - 1],
      [left, width - right - 1],
      [width - right, width - 1],
    ],
    rows: [
      [0, top - 1],
      [top, height - bottom - 1],
      [height - bottom, height - 1],
    ],
  };
}

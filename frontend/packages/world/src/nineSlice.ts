/**
 * A nine-slice border made from a picture that was not painted as one: an image model's nine tiles with
 * lines between them, or a framed box standing on stone, on black, round a box of white. Only the frame is
 * kept. The lines are cut out and the tiles joined, so the cuts fall where the tiles met; what the frame
 * stands on, outside it and inside it, is cleared; and the middle tile is made a fill of its own or
 * dropped, for a fill of another picture's.
 *
 * Pure, so every rule is a test; `bin/nineSlice.ts` reads and writes. The nine-slice skill is how a job is
 * done, and `AUTHORING-THE-ART.md` says where the pictures go. See decision record 0068.
 */

import type { Rgba } from './art.ts';
import { REPEATS } from './uiArt.ts';
import type { BorderFile, Repeat, Sides } from './uiArt.ts';

/** A run of columns or rows, both ends counted. */
export type Span = readonly [from: number, to: number];

export const spanLength = ([from, to]: Span): number => to - from + 1;

/** The runs of places along a line of `length` where `is` holds. */
export function runsOf(length: number, is: (at: number) => boolean): Span[] {
  const runs: Span[] = [];
  let start = -1;
  for (let at = 0; at < length; at += 1) {
    if (is(at) && start < 0) {
      start = at;
    } else if (!is(at) && start >= 0) {
      runs.push([start, at - 1]);
      start = -1;
    }
  }
  if (start >= 0) {
    runs.push([start, length - 1]);
  }
  return runs;
}

/** Whether the lines an image model left between its tiles are white or black. */
export type GapShade = 'light' | 'dark';

const brightness = (data: Uint8Array, at: number) => (data[at]! + data[at + 1]! + data[at + 2]!) / 3;
const chroma = (data: Uint8Array, at: number) =>
  Math.max(data[at]!, data[at + 1]!, data[at + 2]!) - Math.min(data[at]!, data[at + 1]!, data[at + 2]!);

/** A pixel of the gap itself: opaque, and white or black. */
function inGap(data: Uint8Array, at: number, shade: GapShade): boolean {
  if (data[at + 3]! < 200) {
    return false;
  }
  return shade === 'light'
    ? brightness(data, at) >= 235 && chroma(data, at) <= 20
    : brightness(data, at) <= 12;
}

/** A pixel of the edge a gap leaves on a tile beside it: the gap's colour, blended, and not the frame's. */
function inFringe(data: Uint8Array, at: number, shade: GapShade): boolean {
  if (data[at + 3]! <= 15) {
    return false;
  }
  return shade === 'light' ? brightness(data, at) > 140 && chroma(data, at) < 40 : brightness(data, at) < 16;
}

type Axis = 'columns' | 'rows';

/**
 * How much of a line - a column or a row - is a gap's colour, or its edge's: over the middle nine tenths
 * of it, so that a margin of the same colour round the picture does not count, and past the places
 * `skip` names, where the lines the other way cross it.
 */
function shareOf(
  image: Rgba,
  axis: Axis,
  line: number,
  is: (data: Uint8Array, at: number) => boolean,
  skip: (along: number) => boolean = () => false,
): number {
  const length = axis === 'columns' ? image.height : image.width;
  const from = Math.floor(length * 0.05);
  const to = Math.ceil(length * 0.95);
  let count = 0;
  let counted = 0;
  for (let along = from; along < to; along += 1) {
    if (skip(along)) {
      continue;
    }
    const at = axis === 'columns' ? (along * image.width + line) * 4 : (line * image.width + along) * 4;
    count += is(image.data, at) ? 1 : 0;
    counted += 1;
  }
  return counted === 0 ? 0 : count / counted;
}

/** A line that is a gap: nine tenths of it the gap's colour. */
const GAP_SHARE = 0.9;
/** A line beside a gap that is still its edge: enough of the gap's colour in it to show as a line. */
const FRINGE_SHARE = 0.03;
/** How far either side of a line crossing it is not counted, for the edge that line leaves. */
const CROSSING = 3;
/** The lines a gap's edge is measured against: this far from the gap, where its edge cannot reach. */
const BASELINE = [6, 12] as const;
/** The most a gap is widened by on either side: an edge is a blend, a pixel or two, not a band. */
const WIDEST = 5;

/**
 * The lines between the tiles across a picture: columns and rows that are white, or black, nearly the
 * whole of their length and are not at the picture's edge, where a margin of the same colour would
 * otherwise count. Each is widened while the line beside it still carries enough of the gap's colour - the
 * pale or dark edge a gap leaves on the tiles either side - to show as a line once they are joined; where
 * the lines the other way cross it is not counted, or every line would be an edge.
 */
export function gapsIn(image: Rgba): { columns: Span[]; rows: Span[]; shade: GapShade | null } {
  for (const shade of ['light', 'dark'] as const) {
    const found = (axis: Axis): Span[] => {
      const lines = axis === 'columns' ? image.width : image.height;
      return runsOf(
        lines,
        (line) => shareOf(image, axis, line, (data, at) => inGap(data, at, shade)) >= GAP_SHARE,
      ).filter(([from, to]) => from > 0 && to < lines - 1);
    };
    const columns = found('columns');
    const rows = found('rows');
    if (columns.length === 0 && rows.length === 0) {
      continue;
    }
    const crossedBy = (spans: readonly Span[]) => (along: number) =>
      spans.some(([from, to]) => along >= from - CROSSING && along <= to + CROSSING);
    const widened = (axis: Axis, spans: readonly Span[], crossings: readonly Span[]): Span[] => {
      const lines = axis === 'columns' ? image.width : image.height;
      const fringe = (line: number) =>
        line >= 0 && line < lines
          ? shareOf(image, axis, line, (data, at) => inFringe(data, at, shade), crossedBy(crossings))
          : 0;
      // What a line a little way off carries of the gap's colour anyway - a margin, a groove - which the
      // lines beside the gap are measured against rather than against nothing.
      const usual = (from: number, step: number) => {
        const shares: number[] = [];
        for (let away = BASELINE[0]; away <= BASELINE[1]; away += 1) {
          const line = from + step * away;
          if (line >= 0 && line < lines) {
            shares.push(fringe(line));
          }
        }
        shares.sort((a, b) => a - b);
        return shares.length === 0 ? 0 : shares[Math.floor(shares.length / 2)]!;
      };
      return spans.map(([from, to]): Span => {
        let start = from;
        let end = to;
        const before = usual(from, -1);
        const after = usual(to, 1);
        for (let step = 0; step < WIDEST && fringe(start - 1) - before >= FRINGE_SHARE; step += 1) {
          start -= 1;
        }
        for (let step = 0; step < WIDEST && fringe(end + 1) - after >= FRINGE_SHARE; step += 1) {
          end += 1;
        }
        return [start, end];
      });
    };
    return { columns: widened('columns', columns, rows), rows: widened('rows', rows, columns), shade };
  }
  return { columns: [], rows: [], shade: null };
}

/** The three tiles either side of and between two gaps, along a line of `length`. */
export function tilesBetween(gaps: readonly Span[], length: number): [Span, Span, Span] {
  if (gaps.length !== 2) {
    throw new Error(
      `found ${gaps.length} lines between tiles where there should be two; say where the tiles are instead`,
    );
  }
  const [first, second] = gaps as [Span, Span];
  return [
    [0, first[0] - 1],
    [first[1] + 1, second[0] - 1],
    [second[1] + 1, length - 1],
  ];
}

/** The nine tiles laid edge to edge, the gaps between them gone; the middle one left clear, if asked. */
export function joined(
  image: Rgba,
  columns: readonly Span[],
  rows: readonly Span[],
  clearMiddle: boolean,
): Rgba {
  const width = columns.reduce((sum, span) => sum + spanLength(span), 0);
  const height = rows.reduce((sum, span) => sum + spanLength(span), 0);
  const data = new Uint8Array(width * height * 4);
  let top = 0;
  rows.forEach((rowSpan, row) => {
    let left = 0;
    columns.forEach((columnSpan, column) => {
      if (!(clearMiddle && row === 1 && column === 1)) {
        for (let y = rowSpan[0]; y <= rowSpan[1]; y += 1) {
          const from = (y * image.width + columnSpan[0]) * 4;
          const to = ((top + y - rowSpan[0]) * width + left) * 4;
          data.set(image.data.subarray(from, from + spanLength(columnSpan) * 4), to);
        }
      }
      left += spanLength(columnSpan);
    });
    top += spanLength(rowSpan);
  });
  return { width, height, data };
}

/**
 * How a frame is told from what it stands on. `alpha`: the picture is clear round it already. `warmth`:
 * a gilt frame is warm - its red well above its blue, even in its darkest groove - and the stone, the
 * black and the white it stands on are not, so whatever is cooler than this is what it stands on.
 */
export type Background = 'alpha' | { readonly warmth: number };

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
export function clearBackground(image: Rgba, background: Background): Rgba {
  if (background === 'alpha') {
    return image;
  }
  const { width, height, data } = image;
  const below = background.warmth;
  const behind = (pixel: number) => data[pixel * 4 + 3]! < 128 || warmthAt(data, pixel * 4) < below;
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
  seed(Math.floor(height / 2) * width + Math.floor(width / 2));
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
    const share = besideFrame ? Math.max(0, Math.min(1, (warmthAt(data, pixel * 4) - (below - 10)) / 10)) : 0;
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
export function borderFileFor(slice: Sides, depths: Sides, repeat: Repeat, content: Sides): BorderFile {
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

/** What `world/ui/sources/<name>.json` says: how the picture beside it is made into a border. */
export interface NineSliceRecipe {
  /** The picture in `world/ui/sources/` it is made from, as Adam gave it. */
  readonly picture: string;
  /** How the frame is told from what it stands on. */
  readonly background: Background;
  /** Where the tiles are, when the lines between them should not be found by themselves. */
  readonly columns?: readonly [Span, Span, Span];
  readonly rows?: readonly [Span, Span, Span];
  /** How the edges are laid between the corners: `round` unless it says otherwise. */
  readonly repeat: Repeat;
  /** A fill to make of the middle tile, by name; left out, the middle is dropped for a fill of another's. */
  readonly fill?: string;
  /**
   * Where the words start, in from each edge of the joined picture, in its own pixels; left out, it is
   * worked out, past the edges and clear of the corners' ornaments.
   */
  readonly content?: Sides;
}

const isSpan = (value: unknown): value is Span =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((one) => Number.isInteger(one) && (one as number) >= 0) &&
  (value[0] as number) <= (value[1] as number);

const threeSpans = (value: unknown): value is readonly [Span, Span, Span] =>
  Array.isArray(value) && value.length === 3 && value.every(isSpan);

/** Reads a recipe, refusing anything it would have to guess at, with a message saying what to write. */
export function readNineSliceRecipe(text: string, where: string): NineSliceRecipe {
  let given: Record<string, unknown>;
  try {
    given = JSON.parse(text) as Record<string, unknown>;
  } catch (cause) {
    throw new Error(`${where} is not JSON: ${(cause as Error).message}`, { cause });
  }
  const known = new Set(['picture', 'background', 'columns', 'rows', 'repeat', 'fill', 'content']);
  const stray = Object.keys(given).filter((key) => !known.has(key));
  if (stray.length > 0) {
    throw new Error(
      `${where}: ${stray.join(', ')} is not something a recipe says; it says ${[...known].join(', ')}`,
    );
  }
  if (typeof given.picture !== 'string' || given.picture === '') {
    throw new Error(`${where} says no picture: the file in world/ui/sources/ the border is made from`);
  }
  const background = given.background;
  const warmth = (background as { warmth?: unknown } | null)?.warmth;
  if (background !== 'alpha' && !(typeof warmth === 'number' && warmth > 0 && warmth < 255)) {
    throw new Error(
      `${where}: background is "alpha", for a picture clear round its frame, or { "warmth": 30 }, for a ` +
        'gilt frame on anything cooler',
    );
  }
  for (const key of ['columns', 'rows'] as const) {
    if (given[key] !== undefined && !threeSpans(given[key])) {
      throw new Error(`${where}: ${key} is three spans, [first, last] each, both counted`);
    }
  }
  const repeat = given.repeat ?? 'round';
  if (!(REPEATS as readonly unknown[]).includes(repeat)) {
    throw new Error(`${where}: repeat is one of ${REPEATS.join(', ')}`);
  }
  if (
    given.fill !== undefined &&
    (typeof given.fill !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(given.fill))
  ) {
    throw new Error(`${where}: fill is a name, lowercase words joined by hyphens, like dark-felt`);
  }
  return {
    picture: given.picture,
    background: background === 'alpha' ? 'alpha' : { warmth: warmth as number },
    ...(given.columns === undefined ? {} : { columns: given.columns as [Span, Span, Span] }),
    ...(given.rows === undefined ? {} : { rows: given.rows as [Span, Span, Span] }),
    repeat: repeat as Repeat,
    ...(given.fill === undefined ? {} : { fill: given.fill as string }),
    ...(given.content === undefined ? {} : { content: contentGiven(given.content, where) }),
  };
}

/** Where a recipe says the words start: one length for every side, or four. */
function contentGiven(value: unknown, where: string): Sides {
  const length = (one: unknown) => Number.isInteger(one) && (one as number) >= 0;
  if (length(value)) {
    return [value as number, value as number, value as number, value as number];
  }
  if (Array.isArray(value) && value.length === 4 && value.every(length)) {
    return [value[0] as number, value[1] as number, value[2] as number, value[3] as number];
  }
  throw new Error(
    `${where}: content is one length or four - top, right, bottom, left - in the picture's own pixels`,
  );
}

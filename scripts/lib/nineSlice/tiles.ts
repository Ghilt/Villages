/**
 * A nine-slice border made from a picture that was not painted as one: an image model's nine tiles with
 * lines between them, or a framed box standing on stone, on black, round a box of white. Only the frame is
 * kept. The lines are cut out and the tiles joined, so the cuts fall where the tiles met; what the frame
 * stands on, outside it and inside it, is cleared; and the middle tile is made a fill of its own or
 * dropped, for a fill of another picture's.
 *
 * Pure, so every rule is a test; `scripts/nine-slice.ts` reads and writes. The nine-slice skill is how a job is
 * done, and `AUTHORING-THE-ART.md` says where the pictures go. See decision record 0068.
 */

import type { Rgba } from '../border.ts';

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

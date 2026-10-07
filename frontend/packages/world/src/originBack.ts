import { ORIGIN_EARTH } from './originFile.ts';
import type { OriginGrid } from './originFile.ts';

/**
 * The origin map run backwards: from a point on plain Earth to the place in the world it went to, which is
 * how a real name, and one day a real town or a real event, reaches the world. See `originFile.ts` for the
 * forward direction and `docs/plans/real-world-names.md` for why.
 *
 * Each square from Earth covers a turned, stretched patch of Earth, so Earth is cut into buckets as big as a
 * square and every square is filed under the buckets its patch touches. A point is then asked of the few
 * squares in its bucket: run each one's placement backwards and see whether it lands inside that square.
 * Only squares from Earth answer. Land Adam removed, and a **Copy**, are nowhere, so a place that went with
 * them has no place in the world; where two squares straddling a seam both answer, the surer one does.
 */
export interface WayBack {
  readonly grid: OriginGrid;
  /** Plain Earth's master, as wide and tall as the world's in pixels. */
  readonly width: number;
  readonly height: number;
  readonly columns: number;
  readonly rows: number;
  /** Where each bucket's squares begin in `squares`, and one past the last bucket. */
  readonly start: Int32Array;
  readonly squares: Int32Array;
}

export function wayBackOf(grid: OriginGrid, width: number, height: number): WayBack {
  const columns = Math.ceil(width / grid.cell);
  const rows = Math.ceil(height / grid.cell);
  const filed: number[][] = Array.from({ length: columns * rows }, () => []);
  const half = grid.cell / 2;
  for (let k = 0; k < grid.status.length; k += 1) {
    if (grid.status[k] !== ORIGIN_EARTH) continue;
    // The patch of Earth the square covers: its four corners, carried.
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const [dx, dy] of CORNERS) {
      const x = grid.x[k]! + (grid.a[k]! * dx + grid.b[k]! * dy) * half;
      const y = grid.y[k]! + (grid.c[k]! * dx + grid.d[k]! * dy) * half;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    for (
      let row = Math.max(0, Math.floor(top / grid.cell));
      row <= Math.min(rows - 1, Math.floor(bottom / grid.cell));
      row += 1
    ) {
      for (let column = Math.floor(left / grid.cell); column <= Math.floor(right / grid.cell); column += 1) {
        filed[row * columns + (((column % columns) + columns) % columns)]!.push(k);
      }
    }
  }
  const start = new Int32Array(columns * rows + 1);
  filed.forEach((list, at) => (start[at + 1] = start[at]! + list.length));
  const squares = new Int32Array(start[columns * rows]!);
  filed.forEach((list, at) => squares.set(list, start[at]!));
  return { grid, width, height, columns, rows, start, squares };
}

/** How far past its own edge, in pixels, a square still answers for a point no square covers. */
const SLACK = 1.5;

const CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

/** Where a pixel of plain Earth went in the world, in the world master's pixels, or null if it went nowhere. */
export function toWorld(back: WayBack, x: number, y: number): [number, number] | null {
  const { grid, width } = back;
  if (y < 0 || y >= back.height) return null;
  const wrapped = ((x % width) + width) % width;
  const bucket = Math.floor(y / grid.cell) * back.columns + Math.floor(wrapped / grid.cell);
  let best: [number, number] | null = null;
  let beyond = Infinity;
  let sure = -1;
  for (let o = back.start[bucket]!; o < back.start[bucket + 1]!; o += 1) {
    const k = back.squares[o]!;
    let dx = wrapped - grid.x[k]!;
    if (dx > width / 2) dx -= width;
    if (dx < -width / 2) dx += width;
    const dy = y - grid.y[k]!;
    const a = grid.a[k]!;
    const b = grid.b[k]!;
    const c = grid.c[k]!;
    const d = grid.d[k]!;
    const det = a * d - b * c;
    if (det === 0) continue;
    const across = (d * dx - b * dy) / det;
    const down = (-c * dx + a * dy) / det;
    const half = grid.cell / 2;
    // Neighbouring squares' placements are each found to within a pixel, so the patches they cover leave
    // slivers of Earth between them that are nobody's. A point in one goes to the square it is nearest.
    const outside = Math.max(0, Math.abs(across) - half, Math.abs(down) - half);
    if (outside > SLACK) continue;
    if (outside > beyond || (outside === beyond && grid.agreement[k]! <= sure)) continue;
    beyond = outside;
    sure = grid.agreement[k]!;
    best = [
      (k % grid.columns) * grid.cell + half + across,
      Math.floor(k / grid.columns) * grid.cell + half + down,
    ];
  }
  return best;
}

import { ORIGIN_CLONE, ORIGIN_EARTH } from './originFile.ts';

/** What `markClones` needs to know of the squares and their placements. */
export interface Placed {
  readonly columns: number;
  readonly rows: number;
  readonly cell: number;
  /** How wide plain Earth's master is, so that a placement across the date line is not taken for far away. */
  readonly earthWidth: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Four numbers a square: the matrix `a b / c d`. */
  readonly m: Float64Array;
  neighbours(k: number): number[];
}

/**
 * Marks copies, and says how many squares were.
 *
 * A piece is the squares from Earth that sit together and agree on their placement: each one's carries it
 * onto its neighbour's within a few pixels. Where two pieces came from the same place on Earth, the smaller is
 * a copy - a paste, or the Clone Stamp - because every real place lands in the world at most once. A piece
 * counts as a copy when half of it or more lies on ground a larger piece came from, so that two pieces cut
 * apart along a line, which share only the squares straddling it, are not.
 */
export function markClones(status: Uint8Array, placed: Placed): number {
  const { columns, rows, cell, x, y, m } = placed;
  const n = status.length;
  const parent = Int32Array.from({ length: n }, (_, k) => k);
  const root = (k: number): number => {
    while (parent[k] !== k) {
      parent[k] = parent[parent[k]!]!;
      k = parent[k]!;
    }
    return k;
  };
  for (let k = 0; k < n; k += 1) {
    if (status[k] !== ORIGIN_EARTH) continue;
    for (const next of placed.neighbours(k)) {
      if (next < k || status[next] !== ORIGIN_EARTH) continue;
      let dx = (next % columns) - (k % columns);
      if (dx > 1) dx -= columns;
      if (dx < -1) dx += columns;
      const dy = Math.floor(next / columns) - Math.floor(k / columns);
      const ex = x[k]! + (m[k * 4]! * dx + m[k * 4 + 1]! * dy) * cell;
      const ey = y[k]! + (m[k * 4 + 2]! * dx + m[k * 4 + 3]! * dy) * cell;
      let across = Math.abs(ex - x[next]!);
      if (across > placed.earthWidth / 2) across = placed.earthWidth - across;
      if (Math.hypot(across, ey - y[next]!) <= 3) parent[root(next)] = root(k);
    }
  }
  const size = new Int32Array(n);
  for (let k = 0; k < n; k += 1) if (status[k] === ORIGIN_EARTH) size[root(k)]! += 1;
  // Which piece came from each square of Earth: the largest of those that did.
  const placeOf = (k: number): number =>
    Math.min(rows - 1, Math.max(0, Math.floor(y[k]! / cell))) * columns +
    (Math.floor(x[k]! / cell) % columns);
  const owner = new Int32Array(n).fill(-1);
  for (let k = 0; k < n; k += 1) {
    if (status[k] !== ORIGIN_EARTH) continue;
    const held = owner[placeOf(k)]!;
    if (held < 0 || size[held]! < size[root(k)]!) owner[placeOf(k)] = root(k);
  }
  const overlap = new Int32Array(n);
  for (let k = 0; k < n; k += 1) {
    if (status[k] === ORIGIN_EARTH && owner[placeOf(k)] !== root(k)) overlap[root(k)]! += 1;
  }
  let cloned = 0;
  for (let k = 0; k < n; k += 1) {
    if (status[k] === ORIGIN_EARTH && overlap[root(k)]! * 2 >= size[root(k)]!) {
      status[k] = ORIGIN_CLONE;
      cloned += 1;
    }
  }
  return cloned;
}

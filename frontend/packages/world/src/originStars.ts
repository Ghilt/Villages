import type { ClassRaster } from './raster.ts';

/**
 * Landmarks for finding where a piece of an edited master came from on Earth: its small lakes, as points.
 *
 * A master begins as Earth, and Adam moves land about with Nearest Neighbour, so a piece he moved keeps its
 * pixels and its lakes keep their pattern. A million small lakes are scattered over the world; this finds
 * them and the ones near any place. What four of them together say is `originQuads.ts`.
 */

/** Points, bucketed on a grid so that the ones near a place are found without looking at the rest. */
export interface StarField {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly count: number;
  readonly bucket: number;
  readonly columns: number;
  readonly rows: number;
  /** Where each bucket's stars begin in `order`, and one past the last bucket. */
  readonly start: Int32Array;
  readonly order: Int32Array;
}

/** The middle of every lake no larger than `largest` pixels, a lake being pixels of one class touching side by side. */
export function starsOf(raster: ClassRaster, lake: number, largest = 30, bucket = 16): StarField {
  const { width, height, cells } = raster;
  const seen = new Uint8Array(cells.length);
  // A lake too big to be a point is still walked to the end, so that its far side is not taken for a lake
  // of its own; it is only not kept.
  const stack: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let first = 0; first < cells.length; first += 1) {
    if (cells[first] !== lake || seen[first] === 1) continue;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    stack.push(first);
    seen[first] = 1;
    while (stack.length > 0) {
      const at = stack.pop()!;
      const x = at % width;
      const y = (at - x) / width;
      area += 1;
      sumX += x;
      sumY += y;
      if (x > 0 && seen[at - 1] === 0 && cells[at - 1] === lake) visit(at - 1);
      if (x < width - 1 && seen[at + 1] === 0 && cells[at + 1] === lake) visit(at + 1);
      if (y > 0 && seen[at - width] === 0 && cells[at - width] === lake) visit(at - width);
      if (y < height - 1 && seen[at + width] === 0 && cells[at + width] === lake) visit(at + width);
    }
    if (area <= largest) {
      xs.push(sumX / area + 0.5);
      ys.push(sumY / area + 0.5);
    }
  }
  function visit(at: number): void {
    seen[at] = 1;
    stack.push(at);
  }
  return fieldOf(Float64Array.from(xs), Float64Array.from(ys), width, height, bucket);
}

export function fieldOf(
  x: Float64Array,
  y: Float64Array,
  width: number,
  height: number,
  bucket = 16,
): StarField {
  const columns = Math.ceil(width / bucket);
  const rows = Math.ceil(height / bucket);
  const start = new Int32Array(columns * rows + 1);
  const home = new Int32Array(x.length);
  for (let star = 0; star < x.length; star += 1) {
    home[star] = Math.floor(y[star]! / bucket) * columns + Math.floor(x[star]! / bucket);
    start[home[star]! + 1]! += 1;
  }
  for (let at = 0; at < columns * rows; at += 1) start[at + 1]! += start[at]!;
  const filled = start.slice(0, columns * rows);
  const order = new Int32Array(x.length);
  for (let star = 0; star < x.length; star += 1) order[filled[home[star]!]!++] = star;
  return { x, y, count: x.length, bucket, columns, rows, start, order };
}

/** Every star within `radius` of a place, into `out`. */
export function starsWithin(field: StarField, x: number, y: number, radius: number, out: number[]): number[] {
  out.length = 0;
  const { bucket, columns } = field;
  const left = Math.max(0, Math.floor((x - radius) / bucket));
  const right = Math.min(columns - 1, Math.floor((x + radius) / bucket));
  const up = Math.max(0, Math.floor((y - radius) / bucket));
  const down = Math.min(field.rows - 1, Math.floor((y + radius) / bucket));
  for (let row = up; row <= down; row += 1) {
    for (let column = left; column <= right; column += 1) {
      const at = row * columns + column;
      for (let o = field.start[at]!; o < field.start[at + 1]!; o += 1) {
        const star = field.order[o]!;
        const dx = field.x[star]! - x;
        const dy = field.y[star]! - y;
        if (dx * dx + dy * dy <= radius * radius) out.push(star);
      }
    }
  }
  return out;
}

/** The `k` stars nearest to one star and no further than `radius`, nearest first, into `out`. */
export function nearestStars(
  field: StarField,
  star: number,
  k: number,
  radius: number,
  out: number[],
): number[] {
  out.length = 0;
  const { bucket, columns, rows } = field;
  const x = field.x[star]!;
  const y = field.y[star]!;
  const homeColumn = Math.floor(x / bucket);
  const homeRow = Math.floor(y / bucket);
  const distances: number[] = [];
  for (let ring = 0; ring * bucket <= radius + bucket; ring += 1) {
    for (let row = homeRow - ring; row <= homeRow + ring; row += 1) {
      if (row < 0 || row >= rows) continue;
      const edge = row === homeRow - ring || row === homeRow + ring;
      const step = edge || ring === 0 ? 1 : 2 * ring;
      for (let column = homeColumn - ring; column <= homeColumn + ring; column += step) {
        if (column < 0 || column >= columns) continue;
        const at = row * columns + column;
        for (let o = field.start[at]!; o < field.start[at + 1]!; o += 1) {
          const other = field.order[o]!;
          if (other === star) continue;
          const dx = field.x[other]! - x;
          const dy = field.y[other]! - y;
          const d = dx * dx + dy * dy;
          if (d > radius * radius || (distances.length === k && d >= distances[k - 1]!)) continue;
          let place = distances.length;
          while (place > 0 && distances[place - 1]! > d) place -= 1;
          distances.splice(place, 0, d);
          out.splice(place, 0, other);
          if (distances.length > k) {
            distances.pop();
            out.pop();
          }
        }
      }
    }
    if (distances.length === k && Math.sqrt(distances[k - 1]!) <= ring * bucket) break;
  }
  return out;
}

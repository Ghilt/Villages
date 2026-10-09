import { diamondAt, diamondLattice, frameOf, worldXOf, worldYOf } from '@villages/world';
import type { DiamondGrid } from '@villages/world';

/**
 * The water a click picked out, as cells of a grid, and how far along the water from the click each lies, which a
 * ripple runs out through. A flourish, and nothing more.
 *
 * A cell is taken where `open` allows it - water of the kind the server named, on ground the page may show. A river
 * or a lake the server named comes with where it runs, a river's whole course or a lake's shores, and the water
 * along that is taken however its painting breaks; the sea, which has no course, is the water joined to the click.
 * The click need not be on the water: the server reads the ground in cells some eighteen kilometres across, so the
 * water may be a few cells off, and the nearest within `near` is taken. Pure, so the shapes can be held to a test;
 * the tiles they are read from are the caller's. See decision records 0032 and 0087.
 */

/** Whether the cell whose middle is at this place, in world units, may be taken. */
export type Open = (x: number, y: number) => boolean;

/** A place, in longitude and latitude. */
export interface LngLat {
  readonly lng: number;
  readonly lat: number;
}

/** A cell of the water, and how far along the water from the click it lies, in cells. */
export interface Reached {
  readonly column: number;
  readonly row: number;
  readonly far: number;
}

/** Steps to the four cells a cell shares an edge with. */
const EDGEWISE = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** A cell as one number, so that sets of them stay cheap: a lattice of a world this size stays well inside. */
const OFFSET = 2 ** 20;
const ACROSS = 2 ** 21;
export function keyOf(column: number, row: number): number {
  return (row + OFFSET) * ACROSS + (column + OFFSET);
}
export function cellOf(key: number): [number, number] {
  const column = (key % ACROSS) - OFFSET;
  return [column, (key - column - OFFSET) / ACROSS - OFFSET];
}

/** The water joined edge to edge to the cell nearest the click, no further from it than `reach`: the sea's. */
export function cellsAround(
  place: LngLat,
  grid: DiamondGrid,
  open: Open,
  reach: number,
  near: number,
): Set<number> {
  const start = diamondAt(grid, place);
  const takes = opening(
    grid,
    open,
    (column, row) => (column - start.column) ** 2 + (row - start.row) ** 2 <= reach * reach,
  );
  const seed = seedNear(start, near, takes);
  return seed === null ? new Set() : flood([keyOf(...seed)], takes);
}

/**
 * Whether cells taken about a click within `reach` run out to its edge, so that the water may go on past it and a
 * wider reach would take more.
 */
export function cutShort(
  place: LngLat,
  grid: DiamondGrid,
  cells: ReadonlySet<number>,
  reach: number,
): boolean {
  const start = diamondAt(grid, place);
  const edge = (reach - 1.5) ** 2;
  for (const key of cells) {
    const [column, row] = cellOf(key);
    if ((column - start.column) ** 2 + (row - start.row) ** 2 > edge) {
      return true;
    }
  }
  return false;
}

/**
 * The water along where a named river or lake runs, however its painting breaks: from every open cell within
 * `seed` cells of its lines, the water joined to it edge to edge - no further from the lines than `keep` cells for a
 * river, so a tributary is taken only at its mouth, and anywhere within the lines' own bounds for a lake, whose
 * shores the lines are.
 */
export function cellsAlong(
  lines: readonly (readonly LngLat[])[],
  grid: DiamondGrid,
  open: Open,
  seed: number,
  keep: number | null,
): Set<number> {
  const frame = frameOf(diamondLattice(grid));
  const onGrid = (place: LngLat): [number, number] => {
    const x = ((place.lng + 180) / 360) * grid.width;
    const sinLat = Math.sin((place.lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * grid.width;
    // Back through the turn the lattice is drawn at: world space onto its two axes.
    return [x * frame.cos + y * frame.sin, -x * frame.sin + y * frame.cos];
  };

  // How far from the lines each cell near them is, walking every piece of every line half a cell at a time.
  const reach = keep ?? seed;
  const near = new Map<number, number>();
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const line of lines) {
    const points = line.map(onGrid);
    for (const [u, v] of points) {
      [left, top, right, bottom] = [
        Math.min(left, u),
        Math.min(top, v),
        Math.max(right, u),
        Math.max(bottom, v),
      ];
    }
    for (let at = 0; at < points.length; at += 1) {
      const [u0, v0] = points[at]!;
      const [u1, v1] = points[Math.min(at + 1, points.length - 1)]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) * 2));
      for (let step = 0; step <= steps; step += 1) {
        const u = u0 + ((u1 - u0) * step) / steps;
        const v = v0 + ((v1 - v0) * step) / steps;
        for (let row = Math.floor(v - reach); row <= Math.floor(v + reach); row += 1) {
          for (let column = Math.floor(u - reach); column <= Math.floor(u + reach); column += 1) {
            const far = Math.hypot(column + 0.5 - u, row + 0.5 - v);
            const key = keyOf(column, row);
            if (far <= reach && far < (near.get(key) ?? Infinity)) near.set(key, far);
          }
        }
      }
    }
  }

  const within =
    keep === null
      ? (column: number, row: number) =>
          column >= left - seed && column <= right + seed && row >= top - seed && row <= bottom + seed
      : (column: number, row: number) => (near.get(keyOf(column, row)) ?? Infinity) <= keep;
  const takes = opening(grid, open, within);
  const seeds = [...near].filter(([key, far]) => far <= seed && takes(...cellOf(key))).map(([key]) => key);
  return flood(seeds, takes);
}

/**
 * The cells taken, from the click outward, nearest first, each with how far along the water it lies: through the
 * cells and never across the land between, so a river is followed up and down its course, a lake round its shore,
 * the sea across a bay. A step may leap up to `leap` cells, so that a river whose painting breaks is followed over
 * the break. No further along than `reach`, and no more than `most` cells.
 */
export function waterFrom(
  place: LngLat,
  grid: DiamondGrid,
  cells: ReadonlySet<number>,
  reach: number,
  near: number,
  most: number,
  leap: number,
): Reached[] {
  const start = diamondAt(grid, place);
  const seed = seedNear(start, near, (column, row) => cells.has(keyOf(column, row)));
  if (seed === null) {
    return [];
  }
  const steps: [number, number, number][] = [];
  for (let dy = -Math.floor(leap); dy <= leap; dy += 1) {
    for (let dx = -Math.floor(leap); dx <= leap; dx += 1) {
      const cost = Math.hypot(dx, dy);
      if (cost > 0 && cost <= Math.max(leap, Math.SQRT2)) steps.push([dx, dy, cost]);
    }
  }

  // Nearest first, through a heap of what is waiting by how far along it is.
  const best = new Map<number, number>([[keyOf(...seed), 0]]);
  const heap = new Waiting();
  heap.push(0, seed[0], seed[1]);
  const reached: Reached[] = [];
  const settled = new Set<number>();
  while (heap.size > 0 && reached.length < most) {
    const [far, column, row] = heap.pop();
    const key = keyOf(column, row);
    if (settled.has(key)) {
      continue;
    }
    settled.add(key);
    reached.push({ column, row, far });
    for (const [dx, dy, cost] of steps) {
      const next = keyOf(column + dx, row + dy);
      const further = far + cost;
      if (
        further <= reach &&
        cells.has(next) &&
        !settled.has(next) &&
        further < (best.get(next) ?? Infinity)
      ) {
        best.set(next, further);
        heap.push(further, column + dx, row + dy);
      }
    }
  }
  return reached;
}

/** Every cell `takes` allows joined edge to edge to the seeds. */
function flood(seeds: readonly number[], takes: (column: number, row: number) => boolean): Set<number> {
  const taken = new Set(seeds);
  const waiting = [...seeds];
  while (waiting.length > 0) {
    const [column, row] = cellOf(waiting.pop()!);
    for (const [dx, dy] of EDGEWISE) {
      const next = keyOf(column + dx, row + dy);
      if (!taken.has(next) && takes(column + dx, row + dy)) {
        taken.add(next);
        waiting.push(next);
      }
    }
  }
  return taken;
}

/** Whether a cell is open, read at its middle, and within whatever bound the caller sets. */
function opening(
  grid: DiamondGrid,
  open: Open,
  within: (column: number, row: number) => boolean,
): (column: number, row: number) => boolean {
  const frame = frameOf(diamondLattice(grid));
  return (column, row) =>
    within(column, row) &&
    open(worldXOf(frame, column + 0.5, row + 0.5), worldYOf(frame, column + 0.5, row + 0.5));
}

/** The open cell nearest the click, a ring of cells at a time, or null within `near`. */
function seedNear(
  start: { column: number; row: number },
  near: number,
  takes: (column: number, row: number) => boolean,
): [number, number] | null {
  for (let ring = 0; ring <= near; ring += 1) {
    let best = Infinity;
    let seed: [number, number] | null = null;
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        const far = dx * dx + dy * dy;
        if (
          Math.max(Math.abs(dx), Math.abs(dy)) === ring &&
          far < best &&
          takes(start.column + dx, start.row + dy)
        ) {
          best = far;
          seed = [start.column + dx, start.row + dy];
        }
      }
    }
    if (seed !== null) {
      return seed;
    }
  }
  return null;
}

/** A binary heap of what is waiting, by how far along it is, least first. */
class Waiting {
  private readonly items: [number, number, number][] = [];

  get size(): number {
    return this.items.length;
  }

  push(far: number, column: number, row: number): void {
    const items = this.items;
    items.push([far, column, row]);
    let at = items.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (items[parent]![0] <= far) break;
      [items[parent], items[at]] = [items[at]!, items[parent]!];
      at = parent;
    }
  }

  pop(): [number, number, number] {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        const right = left + 1;
        let least = at;
        if (left < items.length && items[left]![0] < items[least]![0]) least = left;
        if (right < items.length && items[right]![0] < items[least]![0]) least = right;
        if (least === at) break;
        [items[least], items[at]] = [items[at]!, items[least]!];
        at = least;
      }
    }
    return top;
  }
}

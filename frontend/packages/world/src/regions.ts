import { ORIGIN_EARTH, ORIGIN_SEA } from './originFile.ts';
import type { OriginGrid } from './originFile.ts';
import { fillPolygon } from './raster.ts';
import type { Ring } from './raster.ts';

/**
 * Earth's named regions, its seas and its stretches of land - the Baltic, the Gulf of Bothnia, the Alps, the
 * Gobi - given to every square of the origin map. See `docs/plans/real-world-names.md`.
 *
 * A square from Earth is in whatever region its middle was in on Earth, and by whatever sea that was in or
 * beside. Open sea is harder, because no square of sea came from anywhere: Adam moves land and the sea is
 * what is left between. So a square of sea is named by the coast nearest it - its placement carried out
 * across the water, as that coast's own sea was - which is the plan's "a sea is named by its coasts". Invented
 * land and copies are in no region: nothing real is attached to them.
 */

export type RegionKind = 'sea' | 'land';

/** A named region of plain Earth, in Earth's longitude and latitude, as a source gives it. */
export interface EarthRegion {
  readonly id: string;
  readonly kind: RegionKind;
  /** Its name in English: the one of 1790 where the review gives one, the German Ocean, else the source's. */
  readonly name: string;
  /** Another name worth knowing: today's, where the review's differs, or the source's own. */
  readonly also?: string;
  /** Present where the review of 1790 chose the name. */
  readonly form?: '1790';
  /** What sort of region the source says it is: a sea, a bay, a strait; a range, a desert, a plateau. */
  readonly feature: string;
  /** How much it matters, from 0 the most, and the zoom from which it is worth naming: the source's own. */
  readonly rank?: number;
  readonly from?: number;
  /** Its polygons, each a list of rings. */
  readonly polygons: readonly (readonly Ring[])[];
}

/** For every square, the land it is in and the sea it is by: an index into the list, plus one; nought for none. */
export interface RegionGrid {
  readonly land: Uint16Array;
  readonly sea: Uint16Array;
}

/** How finely Earth is painted with its regions, in pixels of plain Earth's master a cell. */
const PAINT_CELL = 8;
/** How far from a coast's middle, in painted cells, its sea is looked for: about thirty kilometres. */
const COAST_REACH = 3;

/**
 * Every square its land and its sea. `width` and `height` are plain Earth's master's. The regions are painted
 * largest first, so that where a source nests one inside another - a gulf in a sea - the smaller one names it.
 */
export function regionsOf(
  grid: OriginGrid,
  width: number,
  height: number,
  regions: readonly EarthRegion[],
): RegionGrid {
  const columns = Math.ceil(width / PAINT_CELL);
  const rows = Math.ceil(height / PAINT_CELL);
  const painted = { land: paint(regions, 'land', columns, rows), sea: paint(regions, 'sea', columns, rows) };
  const at = (layer: Uint16Array, x: number, y: number, reach: number): number => {
    const column = Math.floor(x / PAINT_CELL);
    const row = Math.floor(y / PAINT_CELL);
    for (let ring = 0; ring <= reach; ring += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        for (let dx = -ring; dx <= ring; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const r = row + dy;
          if (r < 0 || r >= rows) continue;
          const value = layer[r * columns + ((((column + dx) % columns) + columns) % columns)]!;
          if (value !== 0) return value;
        }
      }
    }
    return 0;
  };

  const n = grid.status.length;
  const land = new Uint16Array(n);
  const sea = new Uint16Array(n);
  for (let k = 0; k < n; k += 1) {
    if (grid.status[k] !== ORIGIN_EARTH) continue;
    land[k] = at(painted.land, grid.x[k]!, grid.y[k]!, 0);
    sea[k] = at(painted.sea, grid.x[k]!, grid.y[k]!, COAST_REACH);
  }

  // Open sea, from the nearest coast outward, a ring of squares at a time.
  const from = new Int32Array(n).fill(-1);
  let edge: number[] = [];
  for (let k = 0; k < n; k += 1) {
    if (grid.status[k] === ORIGIN_EARTH) {
      from[k] = k;
      edge.push(k);
    }
  }
  while (edge.length > 0) {
    const next: number[] = [];
    for (const k of edge) {
      for (const neighbour of neighboursOf(k, grid.columns, grid.rows)) {
        if (grid.status[neighbour] !== ORIGIN_SEA || from[neighbour]! >= 0) continue;
        from[neighbour] = from[k]!;
        next.push(neighbour);
      }
    }
    edge = next;
  }
  for (let k = 0; k < n; k += 1) {
    const coast = from[k]!;
    if (grid.status[k] !== ORIGIN_SEA || coast < 0) continue;
    const [x, y] = carriedOut(grid, coast, k);
    if (y >= 0 && y < height) sea[k] = at(painted.sea, x, y, COAST_REACH);
  }
  return { land, sea };
}

/** Where a named region's name is written in the world, and how many squares it covers there. */
export interface RegionLabel {
  readonly at: readonly [number, number];
  readonly squares: number;
}

/**
 * Where each region's name goes: on the square nearest the middle of all its squares, so that it always lies
 * on the region itself, and for a sea on its open water when it has any rather than on a coast beside it. The
 * middle is taken round the world, so that an ocean across the date line is named in it and not on the far
 * side of the Earth. `count` is how many regions there are; a region with no squares has no label.
 */
export function regionLabels(grid: OriginGrid, given: RegionGrid, count: number): (RegionLabel | null)[] {
  const squaresOf: number[][] = Array.from({ length: count + 1 }, () => []);
  const coastOf: number[][] = Array.from({ length: count + 1 }, () => []);
  for (let k = 0; k < grid.status.length; k += 1) {
    if (given.land[k]! > 0) squaresOf[given.land[k]!]!.push(k);
    const sea = given.sea[k]!;
    if (sea > 0) (grid.status[k] === ORIGIN_SEA ? squaresOf : coastOf)[sea]!.push(k);
  }
  return Array.from({ length: count }, (_, index) => {
    const own = squaresOf[index + 1]!.length > 0 ? squaresOf[index + 1]! : coastOf[index + 1]!;
    if (own.length === 0) return null;
    let across = 0;
    let along = 0;
    let down = 0;
    for (const k of own) {
      const turn = (((k % grid.columns) + 0.5) / grid.columns) * 2 * Math.PI;
      across += Math.cos(turn);
      along += Math.sin(turn);
      down += Math.floor(k / grid.columns) + 0.5;
    }
    const column = ((Math.atan2(along, across) / (2 * Math.PI)) * grid.columns + grid.columns) % grid.columns;
    const row = down / own.length;
    let nearest = own[0]!;
    let best = Infinity;
    for (const k of own) {
      let dx = Math.abs((k % grid.columns) + 0.5 - column);
      dx = Math.min(dx, grid.columns - dx);
      const dy = Math.floor(k / grid.columns) + 0.5 - row;
      if (dx * dx + dy * dy < best) {
        best = dx * dx + dy * dy;
        nearest = k;
      }
    }
    const lng = (((nearest % grid.columns) + 0.5) / grid.columns) * 360 - 180;
    const lat = 90 - ((Math.floor(nearest / grid.columns) + 0.5) / grid.rows) * 180;
    return { at: [Math.round(lng * 10000) / 10000, Math.round(lat * 10000) / 10000], squares: own.length };
  });
}

/** Every region of one kind painted on a grid of Earth, the largest first: each cell its region's index plus one. */
function paint(
  regions: readonly EarthRegion[],
  kind: RegionKind,
  columns: number,
  rows: number,
): Uint16Array {
  const raster = { width: columns, height: rows, cells: new Uint16Array(columns * rows) };
  const order = [...regions.keys()]
    .filter((index) => regions[index]!.kind === kind)
    .sort((a, b) => extentOf(regions[b]!) - extentOf(regions[a]!));
  for (const index of order) {
    for (const polygon of regions[index]!.polygons) fillPolygon(raster, polygon, index + 1);
  }
  return raster.cells;
}

function extentOf(region: EarthRegion): number {
  let left = Infinity;
  let right = -Infinity;
  let top = -Infinity;
  let bottom = Infinity;
  for (const polygon of region.polygons) {
    for (const [lng, lat] of polygon[0] ?? []) {
      left = Math.min(left, lng);
      right = Math.max(right, lng);
      bottom = Math.min(bottom, lat);
      top = Math.max(top, lat);
    }
  }
  return (right - left) * (top - bottom);
}

/** Where on Earth square `k` would have been had it come with square `coast`: its placement, carried across. */
function carriedOut(grid: OriginGrid, coast: number, k: number): [number, number] {
  let dx = (k % grid.columns) - (coast % grid.columns);
  if (dx > grid.columns / 2) dx -= grid.columns;
  if (dx < -grid.columns / 2) dx += grid.columns;
  const dy = Math.floor(k / grid.columns) - Math.floor(coast / grid.columns);
  return [
    grid.x[coast]! + (grid.a[coast]! * dx + grid.b[coast]! * dy) * grid.cell,
    grid.y[coast]! + (grid.c[coast]! * dx + grid.d[coast]! * dy) * grid.cell,
  ];
}

function neighboursOf(k: number, columns: number, rows: number): number[] {
  const column = k % columns;
  const row = Math.floor(k / columns);
  const out = [row * columns + ((column + columns - 1) % columns), row * columns + ((column + 1) % columns)];
  if (row > 0) out.push(k - columns);
  if (row < rows - 1) out.push(k + columns);
  return out;
}

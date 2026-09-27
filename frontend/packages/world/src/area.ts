import { alongU, alongV, frameOf, worldXOf, worldYOf } from './lattice.ts';
import type { Lattice, LatticeFrame } from './lattice.ts';
import { fbm, hash2 } from './painterly.ts';
import type { ClassRaster, Ring } from './raster.ts';
import { doubleSignedArea } from './simplify.ts';
import { fromWorld, toWorld } from './sphere.ts';
import type { LngLat } from './sphere.ts';
import { traceClass } from './trace.ts';
import type { LatticePoint, Ring as LatticeRing } from './trace.ts';

/**
 * An area of the world, and the ground it encloses.
 *
 * The ground is painted on **diamonds**: world space cut into squares one unit across and turned as far as
 * the ground's own grid is turned, which the tipped camera draws as diamonds (`lattice.ts`, decision record
 * 0060). They are what a player sees the terrain in, so they are the only honest unit for how much of an
 * area is forest. An area counts diamonds, each as the terrain the painter reads at its middle, so the
 * answer belongs to the area and the world rather than to whatever the camera happened to be looking at
 * when it was asked. Always the finest diamonds, one world unit, whatever size the ground's own cells are
 * painted at: the grid is turned with the ground and never coarsened with it. See decision record 0066.
 *
 * The boundary runs on the lattice between diamonds rather than through them. A hand-drawn path is
 * rasterised once, and the diamonds it landed on are traced back into rings along their edges: that traced
 * ring is the area from then on. It costs one pass and it buys the whole of the exactness. Every edge runs
 * along the grid and falls between two diamonds, so there is no rule for what happens to a diamond an edge
 * cuts, because no edge cuts one. A diamond is inside or outside. Two areas drawn flush against each other
 * share their boundary exactly: none of their diamonds are counted twice and none are missed. And the line
 * on the screen is drawn where the count changes, so what is counted is what is seen. See decision 0032.
 *
 * Everything but the two ends of it is whole numbers on the grid: a diamond is a column and a row, its
 * corners are whole numbers and its middle is a half past each. Only `enclose` and `diamondAt` go in from a
 * place and only `fenceToPolygons` comes back out to one, all three through `lattice.ts`, which is what the
 * painter goes through too.
 *
 * The fence is the only thing worth keeping. What it encloses, what terrain that is, and whether a place
 * is inside it are worked out from the fence whenever they are asked for, so a repainted world or a moved
 * edge means a fresh answer rather than a stale one.
 *
 * Pure, and none of it knows what a map is. Drawing and terrain live in the interface.
 */

/**
 * The grid an area is fenced on: the ground's own diamonds, one world unit across.
 *
 * World space is the Web Mercator square, as many units on a side as the master is wide (decision 0030),
 * so a diamond is exactly as wide as a master pixel. North of the equator Mercator draws a master pixel
 * taller than it is wide, by one over the cosine of the latitude, so there it is taller than a diamond too:
 * about one and a half of them at fifty degrees north.
 */
export interface DiamondGrid {
  /** How many world units the Mercator square is across: the master's width. */
  readonly width: number;
  /** How far the diamonds are turned from the world's own axes, in degrees: as far as the ground is. */
  readonly turn: number;
}

/** The diamonds as the painter is handed them: the grid's turn, one world unit a cell. */
export function diamondLattice(grid: DiamondGrid): Lattice {
  return { turn: grid.turn, size: 1 };
}

function frameOfGrid(grid: DiamondGrid): LatticeFrame {
  return frameOf(diamondLattice(grid));
}

/** Where an area's diamonds sit, so that nothing here allocates a world in order to hold a county. */
export interface DiamondWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One row's worth of enclosed diamonds, from column `from` to column `to`, both inside. */
export interface DiamondSpan {
  row: number;
  from: number;
  to: number;
}

/** The diamonds a shape encloses, a column range at a time, because an area is mostly interior. */
export interface EnclosedDiamonds {
  grid: DiamondGrid;
  window: DiamondWindow;
  spans: readonly DiamondSpan[];
}

/** One piece of an area: its outline, and the holes in it. Both on the lattice, in whole diamonds. */
export interface FencePart {
  outer: LatticeRing;
  holes: readonly LatticeRing[];
}

/**
 * The boundary of an area: rings on the lattice between diamonds.
 *
 * More than one part is not an error. A path that crosses itself encloses a shape with a hole in it, and
 * one that pinches off encloses two pieces; both are what was drawn, so both are kept.
 */
export interface Fence {
  /** The diamonds it is drawn on, without which the whole numbers of its rings mean nothing. */
  readonly grid: DiamondGrid;
  readonly parts: readonly FencePart[];
}

/** A point on a grid, in that grid's own units, and not necessarily a whole number of them. */
export interface GridPoint {
  x: number;
  y: number;
}

/**
 * How far a scan may reach: a box of whole cells it is clipped to, and, finer than the box, which of the
 * cells in the box count at all. Along any one row the cells that count must be a single run, which is true
 * of the part of a convex shape that a row crosses, and is what lets a span be trimmed from its two ends.
 */
export interface ScanBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  within?: (column: number, row: number) => boolean;
}

const EMPTY_WINDOW: DiamondWindow = { x: 0, y: 0, width: 0, height: 0 };

const UNBOUNDED: ScanBounds = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };

const clamp = (value: number, least: number, most: number): number =>
  value < least ? least : value > most ? most : value;

/** Every ring of a fence, outlines and holes alike. Even-odd does not care which is which. */
function allRings(fence: Fence): LatticeRing[] {
  return fence.parts.flatMap((part) => [part.outer, ...part.holes]);
}

/**
 * Where the world ends, on the grid: the box of diamonds the Mercator square reaches into, and which of
 * them lie wholly on it.
 *
 * Wholly, corners and all, because a diamond is drawn by its corners. One that hung off the square would
 * put a vertex past longitude 180, which a map's tiler copies onto the far side of the world, or past the
 * Mercator limit, which it flattens onto the edge. The square is convex, so the diamonds a row keeps are
 * one run, as `ScanBounds` needs. Turned or not, nothing is ever clamped: a shape that runs off the world
 * keeps its edges where they were and simply loses the diamonds past the edge.
 */
function worldOn(grid: DiamondGrid, frame: LatticeFrame): Required<ScanBounds> {
  const { width } = grid;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const [x, y] of [
    [0, 0],
    [width, 0],
    [0, width],
    [width, width],
  ] as const) {
    const u = alongU(frame, x, y);
    const v = alongV(frame, x, y);
    left = Math.min(left, u);
    right = Math.max(right, u);
    top = Math.min(top, v);
    bottom = Math.max(bottom, v);
  }

  const onWorld = (u: number, v: number): boolean => {
    const x = worldXOf(frame, u, v);
    const y = worldYOf(frame, u, v);
    return x >= 0 && x <= width && y >= 0 && y <= width;
  };

  return {
    left: Math.floor(left),
    right: Math.ceil(right) - 1,
    top: Math.floor(top),
    bottom: Math.ceil(bottom) - 1,
    within: (column, row) =>
      onWorld(column, row) &&
      onWorld(column + 1, row) &&
      onWorld(column, row + 1) &&
      onWorld(column + 1, row + 1),
  };
}

/** Where a place lies on the grid, in diamonds and fractions of one. */
function onGrid(place: LngLat, grid: DiamondGrid, frame: LatticeFrame): GridPoint {
  const at = toWorld(place, grid.width);
  return { x: alongU(frame, at.x, at.y), y: alongV(frame, at.x, at.y) };
}

/**
 * The diamond a place is in. The same floor `onLattice` takes, through the same arithmetic, so the diamond
 * a click lands in is the one whose colour the painter read.
 */
export function diamondAt(grid: DiamondGrid, place: LngLat): { column: number; row: number } {
  const at = onGrid(place, grid, frameOfGrid(grid));
  // Plus nought, because a floor of a hair below nought is minus nought, which equality can tell apart.
  return { column: Math.floor(at.x) + 0, row: Math.floor(at.y) + 0 };
}

/**
 * Joins the ends of a hand-drawn path, which is what lets a player let go of the mouse anywhere.
 *
 * A path whose ends already meet is given back untouched, so closing twice is the same as closing once.
 */
export function closePath(path: Ring): Ring {
  if (path.length < 3) {
    return path;
  }
  const first = path[0]!;
  const last = path[path.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) {
    return path;
  }
  return [...path, first];
}

/**
 * The cells a ring encloses, by the even-odd rule, taking a cell when the ring covers its middle. The ring
 * is in the grid's own units already, so this is the whole of the scanline and none of the projection.
 *
 * This is `fillPolygon`'s rule, over a window rather than over a whole raster, so that an area the size of
 * a county does not allocate a world to be counted in. It is deliberately the same rule and deliberately a
 * separate function: `fillPolygon`'s is baked into every coastline of the generated world and may not move,
 * and a test holds the two to each other.
 *
 * No tie-break is needed here and none is invented. This pass only has to turn a wiggle into some set of
 * whole cells; the exactness comes afterwards, from `fenceAround`.
 *
 * Anything with area gets at least the cell it sits in, as `fillPolygon` does, so an area drawn smaller
 * than a cell exists rather than vanishing, unless that cell is outside the bounds too. That is the one
 * case where two areas can claim one cell.
 *
 * Throws rather than allocating when the ring could reach more cells than `most`.
 */
export function scanGrid(
  ring: readonly GridPoint[],
  most: number,
  bounds: ScanBounds = UNBOUNDED,
): { window: DiamondWindow; spans: DiamondSpan[] } {
  const edges: { x0: number; y0: number; x1: number; y1: number }[] = [];
  let leftmost = Infinity;
  let rightmost = -Infinity;
  let topmost = Infinity;
  let bottommost = -Infinity;

  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index]!;
    const b = ring[(index + 1) % ring.length]!;
    leftmost = Math.min(leftmost, a.x);
    rightmost = Math.max(rightmost, a.x);
    topmost = Math.min(topmost, a.y);
    bottommost = Math.max(bottommost, a.y);
    if (a.y === b.y) {
      continue; // A horizontal edge crosses no scanline centre.
    }
    edges.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y });
  }

  if (leftmost === Infinity) {
    return { window: EMPTY_WINDOW, spans: [] };
  }

  // Every cell the ring could possibly take: the ones whose middle its own extent reaches. Wider than
  // the answer by up to a row, which is why it is the guard rather than the window: the cap has to be
  // met before anything is scanned, and the window has to be exactly where the cells turned out to be.
  const left = clamp(Math.ceil(leftmost - 0.5), bounds.left, bounds.right);
  const right = clamp(Math.floor(rightmost - 0.5), bounds.left, bounds.right);
  const top = clamp(Math.floor(topmost), bounds.top, bounds.bottom);
  const bottom = clamp(Math.ceil(bottommost), bounds.top, bounds.bottom);

  const reach = (right - left + 1) * (bottom - top + 1);
  if (reach > most) {
    const size = `${right - left + 1} by ${bottom - top + 1}`;
    throw new Error(`an area of ${size} diamonds is ${reach}, past the ${most} this counts up to`);
  }

  const spans: DiamondSpan[] = [];
  const crossings: number[] = [];

  for (let row = top; row <= bottom; row += 1) {
    const scanline = row + 0.5;
    crossings.length = 0;

    for (const edge of edges) {
      const lower = Math.min(edge.y0, edge.y1);
      const upper = Math.max(edge.y0, edge.y1);
      if (scanline < lower || scanline >= upper) {
        continue;
      }
      const along = (scanline - edge.y0) / (edge.y1 - edge.y0);
      crossings.push(edge.x0 + along * (edge.x1 - edge.x0));
    }

    if (crossings.length < 2) {
      continue;
    }
    crossings.sort((a, b) => a - b);

    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      let from = Math.max(left, Math.ceil(crossings[pair]! - 0.5));
      let to = Math.min(right, Math.floor(crossings[pair + 1]! - 0.5));
      if (bounds.within !== undefined) {
        while (from <= to && !bounds.within(from, row)) {
          from += 1;
        }
        while (to >= from && !bounds.within(to, row)) {
          to -= 1;
        }
      }
      if (from <= to) {
        spans.push({ row: row + 0, from: from + 0, to: to + 0 });
      }
    }
  }

  if (spans.length === 0) {
    // Too small, or too unluckily placed, to cover a cell's middle. It was drawn, so it gets a cell - if
    // the one it sits in is there to be had.
    const first = ring[0]!;
    const column = Math.floor(first.x) + 0;
    const row = Math.floor(first.y) + 0;
    const inBox =
      column >= bounds.left && column <= bounds.right && row >= bounds.top && row <= bounds.bottom;
    if (!inBox || (bounds.within !== undefined && !bounds.within(column, row))) {
      return { window: EMPTY_WINDOW, spans: [] };
    }
    return { window: { x: column, y: row, width: 1, height: 1 }, spans: [{ row, from: column, to: column }] };
  }

  // Where the cells actually turned out to be, which is the same box `fenceWindow` reports for the fence
  // built from them. Anything looser would allocate a row of nothing and count it against the cap.
  let takenLeft = Infinity;
  let takenRight = -Infinity;
  for (const span of spans) {
    takenLeft = Math.min(takenLeft, span.from);
    takenRight = Math.max(takenRight, span.to);
  }
  const firstRow = spans[0]!.row;
  const lastRow = spans[spans.length - 1]!.row;

  return {
    window: { x: takenLeft, y: firstRow, width: takenRight - takenLeft + 1, height: lastRow - firstRow + 1 },
    spans,
  };
}

/**
 * The diamonds a drawn path encloses: into the grid once, then `scanGrid`.
 *
 * Only the diamonds wholly on the world are taken, and the path itself is never clamped: a drag that runs
 * off the edge keeps every edge where the hand put it and loses only what lies past the world.
 */
export function enclose(path: Ring, grid: DiamondGrid, most: number): EnclosedDiamonds {
  const frame = frameOfGrid(grid);
  const points = path.map(([lng, lat]) => onGrid({ lng, lat }, grid, frame));
  const { window, spans } = scanGrid(points, most, worldOn(grid, frame));
  return { grid, window, spans };
}

/** Whether a traced ring is an outline rather than a hole, which is what its signed area says. */
function isOuter(ring: LatticeRing): boolean {
  // Steps are emitted with the diamonds on one consistent side, and the lattice runs south as its second
  // coordinate grows - a turn is a rotation, which keeps which way round a ring goes - so an outline comes
  // out negative and a hole positive. One diamond traced as one square pins this down.
  return doubleSignedArea(ring) < 0;
}

/** Whether a diamond is inside one ring. Even-odd, and every edge of a fence runs along the grid. */
function insideRing(ring: LatticeRing, x: number, y: number): boolean {
  let inside = false;
  for (let index = 0; index + 1 < ring.length; index += 1) {
    const from = ring[index]!;
    const to = ring[index + 1]!;
    if (from.x !== to.x) {
      continue; // An edge along a row sits on a lattice line, and no diamond's middle is on one.
    }
    const lower = Math.min(from.y, to.y);
    const upper = Math.max(from.y, to.y);
    if (y + 0.5 < lower || y + 0.5 >= upper) {
      continue;
    }
    if (from.x > x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Drops the vertices that say nothing: a straight run keeps only its ends.
 *
 * Nothing moves and nothing leaves the lattice, unlike `simplify`, which is for a coastline that wants to
 * look smooth. A fence wants to be exact, so a staircase stays a staircase and only its corners are kept.
 * Without this a rectangle a thousand diamonds wide would be four thousand vertices instead of five.
 */
export function withoutCollinear(ring: LatticeRing): LatticeRing {
  if (ring.length < 4) {
    return ring;
  }
  // The last point repeats the first, so the run of unique vertices is what is walked, as a cycle.
  const unique = ring.slice(0, ring.length - 1);
  const kept: LatticePoint[] = [];

  for (let index = 0; index < unique.length; index += 1) {
    const before = unique[(index - 1 + unique.length) % unique.length]!;
    const here = unique[index]!;
    const after = unique[(index + 1) % unique.length]!;
    const inX = here.x - before.x;
    const inY = here.y - before.y;
    const outX = after.x - here.x;
    const outY = after.y - here.y;
    if (inX * outY - inY * outX !== 0) {
      kept.push(here);
    }
  }

  if (kept.length < 3) {
    return ring;
  }
  return [...kept, kept[0]!];
}

/**
 * The fence around a set of diamonds: the walk along their edges, chained into closed rings.
 *
 * `traceClass` is the same walk a coastline is traced with, so a fence and a coast are the same kind of
 * thing drawn from a lattice. Holes and separate pieces come out of it already, and are kept.
 */
export function fenceAround(enclosed: EnclosedDiamonds): Fence {
  const { grid, window, spans } = enclosed;
  if (window.width <= 0 || window.height <= 0 || spans.length === 0) {
    return { grid, parts: [] };
  }

  const mask: ClassRaster = {
    width: window.width,
    height: window.height,
    cells: new Uint8Array(window.width * window.height),
  };
  for (const span of spans) {
    const line = (span.row - window.y) * window.width;
    mask.cells.fill(1, line + (span.from - window.x), line + (span.to - window.x) + 1);
  }

  const outers: LatticeRing[] = [];
  const holes: LatticeRing[] = [];
  for (const traced of traceClass(mask, 1)) {
    // Back onto the grid's own lattice: the mask only ever knew about its window.
    const moved = traced.map((point) => ({ x: point.x + window.x, y: point.y + window.y }));
    const ring = withoutCollinear(moved);
    (isOuter(ring) ? outers : holes).push(ring);
  }

  const parts: FencePart[] = outers.map((outer) => ({ outer, holes: [] as LatticeRing[] }));
  for (const hole of holes) {
    const at = hole[0]!;
    // The smallest outline that contains it, so a hole in an island in a lake belongs to the island.
    let best = -1;
    let bestSize = Infinity;
    for (let index = 0; index < parts.length; index += 1) {
      const outer = parts[index]!.outer;
      if (!insideRing(outer, at.x, at.y)) {
        continue;
      }
      const size = Math.abs(doubleSignedArea(outer));
      if (size < bestSize) {
        best = index;
        bestSize = size;
      }
    }
    if (best >= 0) {
      (parts[best]!.holes as LatticeRing[]).push(hole);
    }
  }

  return { grid, parts };
}

/** The smallest window holding a fence: where its diamonds are, without counting any of them. */
export function fenceWindow(fence: Fence): DiamondWindow {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;

  for (const ring of allRings(fence)) {
    for (const point of ring) {
      left = Math.min(left, point.x);
      right = Math.max(right, point.x);
      top = Math.min(top, point.y);
      bottom = Math.max(bottom, point.y);
    }
  }

  if (left === Infinity) {
    return EMPTY_WINDOW;
  }
  // Lattice lines bound diamonds, so the diamonds run from the first line up to but not including the last.
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The diamonds a fence encloses. Exact, and this is where that is won.
 *
 * Every edge runs along the grid, so a scanline through a row of diamond middles meets only the edges that
 * cross rows, and it meets them at whole numbers. A crossing at column `c` opens at diamond `c` and the next
 * one closes at diamond `c - 1`: the boundary falls between two diamonds and each belongs to exactly one
 * side of it. No edge passes through a diamond, so there is nothing to decide.
 */
export function enclosedBy(fence: Fence): EnclosedDiamonds {
  const window = fenceWindow(fence);
  if (window.width <= 0 || window.height <= 0) {
    return { grid: fence.grid, window: EMPTY_WINDOW, spans: [] };
  }

  const rings = allRings(fence);
  const spans: DiamondSpan[] = [];
  const crossings: number[] = [];
  const lastRow = window.y + window.height - 1;

  for (let row = window.y; row <= lastRow; row += 1) {
    const scanline = row + 0.5;
    crossings.length = 0;

    for (const ring of rings) {
      for (let index = 0; index + 1 < ring.length; index += 1) {
        const from = ring[index]!;
        const to = ring[index + 1]!;
        if (from.x !== to.x) {
          continue;
        }
        const lower = Math.min(from.y, to.y);
        const upper = Math.max(from.y, to.y);
        if (scanline < lower || scanline >= upper) {
          continue;
        }
        crossings.push(from.x);
      }
    }

    if (crossings.length < 2) {
      continue;
    }
    crossings.sort((a, b) => a - b);

    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      const from = crossings[pair]!;
      const to = crossings[pair + 1]! - 1;
      if (from <= to) {
        spans.push({ row, from, to });
      }
    }
  }

  return { grid: fence.grid, window, spans };
}

/** How many diamonds a fence encloses. The number an area is asked for first. */
export function fenceSize(fence: Fence): number {
  let total = 0;
  for (const span of enclosedBy(fence).spans) {
    total += span.to - span.from + 1;
  }
  return total;
}

/** Whether a diamond is inside a fence. Even-odd, so it agrees with `enclosedBy` on every diamond. */
export function insideFence(fence: Fence, column: number, row: number): boolean {
  let inside = false;
  for (const ring of allRings(fence)) {
    if (insideRing(ring, column, row)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Whether a place is inside a fence: whether the diamond it is in is. The one question a click on the map
 * and a seat in a window both ask, so what the window says is in an area is what the map says is.
 */
export function insideFenceAt(fence: Fence, place: LngLat): boolean {
  const { column, row } = diamondAt(fence.grid, place);
  return insideFence(fence, column, row);
}

/**
 * A fence in longitude and latitude, ready to be drawn: one polygon a part, its outline then its holes.
 *
 * That is GeoJSON's own order, so the result can be handed to a map without rearranging. Each corner goes
 * out of the grid and through Mercator backwards, and a map draws a straight line in Mercator, so every
 * edge is drawn along the lattice line it stands for.
 */
export function fenceToPolygons(fence: Fence): [number, number][][][] {
  const frame = frameOfGrid(fence.grid);
  const { width } = fence.grid;
  const placeOf = (point: LatticePoint): [number, number] => {
    const at = fromWorld(worldXOf(frame, point.x, point.y), worldYOf(frame, point.x, point.y), width);
    return [at.lng, at.lat];
  };
  return fence.parts.map((part) => [part.outer, ...part.holes].map((ring) => ring.map(placeOf)));
}

/**
 * The most diamonds the window of one area drawn round a point may hold: a reach of some five hundred and
 * fifty diamonds, several hundred kilometres.
 *
 * An absolute ceiling rather than a multiple of what was asked for, because a cap that grows with the
 * reach refuses nothing. Nothing in the game comes near it; a reach with a zero too many in it does.
 */
export const MOST_ENCLOSED = 1_200_000;

/** How ragged an area drawn round a point is. Left out, it is a circle of diamonds. */
export interface Roughness {
  /** Which ragged shape: the same seed gives the same one on every screen that draws it. */
  seed: number;
  /** How far the reach wanders in and out on the way round, as a share of the reach. */
  lumps: number;
  /** How far each diamond's own distance is jittered, in diamonds, which is what frays the edge. */
  jitter: number;
}

/**
 * How fast the lumps come round: the noise is read on a circle of this radius, so about this many lumps a
 * radian, a handful the whole way round.
 */
const LUMPS_ACROSS = 1.2;

/** Steps to the four diamonds a diamond shares an edge with, which is what one piece means here. */
const EDGEWISE = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Fills out from the given cells over every cell `open` allows, sharing an edge at each step. Marks what it
 * reached in `reached` and hands it back.
 */
function flood(
  width: number,
  height: number,
  from: readonly number[],
  open: (at: number) => boolean,
  reached: Uint8Array,
): Uint8Array {
  const waiting: number[] = [];
  for (const at of from) {
    if (reached[at] === 0 && open(at)) {
      reached[at] = 1;
      waiting.push(at);
    }
  }
  while (waiting.length > 0) {
    const at = waiting.pop()!;
    const column = at % width;
    const row = (at - column) / width;
    for (const [dx, dy] of EDGEWISE) {
      const x = column + dx;
      const y = row + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) {
        continue;
      }
      const next = y * width + x;
      if (reached[next] === 0 && open(next)) {
        reached[next] = 1;
        waiting.push(next);
      }
    }
  }
  return reached;
}

/**
 * The area a reach out from a point, fenced like any other: the diamonds whose middle lies within `reach`
 * world units of it.
 *
 * This is the technical shape and nothing more. What it *means* is the caller's business: today it is the
 * ground a house holds about its seat, and later it is as easily a castle's influence zone or the reach of
 * a mine. Giving it a name of its own is what lets the flavour change without the geometry moving.
 *
 * Measured in world space, which is Mercator and so round on the ground wherever it is, as the fog's circles
 * are. With `rough`, the reach wanders in and out as it goes round and every diamond's distance is jittered,
 * the same way for the same seed. Whatever it comes out as, it is **one piece with no holes**: only the
 * diamonds joined edge to edge to the one the point is in are kept, and anything they close round is filled.
 * That also leaves no two diamonds touching only at a corner, so the trace is a single ring. The point's
 * own diamond is always in it, as a thing drawn smaller than a diamond still gets the one it sits in.
 *
 * Worked out when it is asked for rather than stored, so a repainted world or a changed reach gives a fresh
 * answer. See decision records 0032 and 0066.
 */
export function areaAround(centre: LngLat, grid: DiamondGrid, reach: number, rough?: Roughness): Fence {
  const frame = frameOfGrid(grid);
  const middle = onGrid(centre, grid, frame);
  const lumps = rough?.lumps ?? 0;
  const jitter = rough?.jitter ?? 0;
  const seed = rough?.seed ?? 0;

  // Far enough out that the window's own edge is never taken, which is what lets the outside be flooded
  // in from the edge to find the holes.
  const furthest = reach * (1 + lumps) + jitter + 2;
  const left = Math.floor(middle.x - furthest);
  const top = Math.floor(middle.y - furthest);
  const width = Math.floor(middle.x + furthest) - left + 1;
  const height = Math.floor(middle.y + furthest) - top + 1;
  if (width * height > MOST_ENCLOSED) {
    throw new Error(
      `a reach of ${reach} is ${width * height} diamonds, past the ${MOST_ENCLOSED} this counts up to`,
    );
  }

  const world = worldOn(grid, frame);
  const taken = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const dx = left + column + 0.5 - middle.x;
      const dy = top + row + 0.5 - middle.y;
      let out = reach;
      if (lumps > 0) {
        // Read round a circle, so the reach comes back to where it started and the shape has no seam.
        const turn = Math.atan2(dy, dx);
        const wobble = fbm(
          Math.cos(turn) * LUMPS_ACROSS + 11.3,
          Math.sin(turn) * LUMPS_ACROSS + 5.7,
          seed,
          3,
        );
        out *= 1 + lumps * (2 * wobble - 1);
      }
      if (jitter > 0) {
        out += jitter * (2 * hash2(left + column, top + row, seed + 1) - 1);
      }
      if (Math.hypot(dx, dy) < out && world.within(left + column, top + row)) {
        taken[row * width + column] = 1;
      }
    }
  }

  const ownColumn = Math.floor(middle.x);
  const ownRow = Math.floor(middle.y);
  if (!world.within(ownColumn, ownRow)) {
    // A point off the world, or on its very edge, has no diamond of its own to grow from.
    return { grid, parts: [] };
  }
  const own = (ownRow - top) * width + (ownColumn - left);
  taken[own] = 1;

  // The piece joined to the point's own diamond, and nothing that only touches it at a corner.
  const kept = flood(width, height, [own], (at) => taken[at] === 1, new Uint8Array(width * height));
  // Whatever the outside cannot reach without crossing the piece is inside it: a hole, filled.
  const border: number[] = [];
  for (let column = 0; column < width; column += 1) {
    border.push(column, (height - 1) * width + column);
  }
  for (let row = 0; row < height; row += 1) {
    border.push(row * width, row * width + width - 1);
  }
  const outside = flood(width, height, border, (at) => kept[at] === 0, new Uint8Array(width * height));

  const spans: DiamondSpan[] = [];
  for (let row = 0; row < height; row += 1) {
    let from = -1;
    for (let column = 0; column <= width; column += 1) {
      const inside = column < width && outside[row * width + column] === 0;
      if (inside && from < 0) {
        from = column;
      } else if (!inside && from >= 0) {
        spans.push({ row: top + row, from: left + from, to: left + column - 1 });
        from = -1;
      }
    }
  }

  let takenLeft = Infinity;
  let takenRight = -Infinity;
  for (const span of spans) {
    takenLeft = Math.min(takenLeft, span.from);
    takenRight = Math.max(takenRight, span.to);
  }
  const firstRow = spans[0]!.row;
  const lastRow = spans[spans.length - 1]!.row;

  return fenceAround({
    grid,
    window: { x: takenLeft, y: firstRow, width: takenRight - takenLeft + 1, height: lastRow - firstRow + 1 },
    spans,
  });
}

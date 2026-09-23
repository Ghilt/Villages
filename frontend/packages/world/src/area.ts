// Aliased: `trace.ts` exports a `toLngLat` of its own, which takes a lattice point and gives a tuple.
// This one takes a pixel and gives the point at its centre, and the two are not interchangeable.
import { toLngLat as lngLatOfPixel, toPixel } from './raster.ts';
import type { ClassRaster, Ring } from './raster.ts';
import { doubleSignedArea } from './simplify.ts';
import type { LngLat } from './sphere.ts';
import { toLngLat, traceClass } from './trace.ts';
import type { LatticePoint, Ring as LatticeRing } from './trace.ts';

/**
 * An area of the world, and the pixels it encloses.
 *
 * The world is painted by hand, one pixel a terrain class, so the only honest unit for how much of an
 * area is forest is a pixel of the master. An area counts master pixels, on the master's own grid, so the
 * answer belongs to the area and the world rather than to whatever the camera happened to be looking at
 * when it was asked.
 *
 * The boundary runs on the lattice between pixels rather than through them. A hand-drawn path is
 * rasterised once, and the pixels it landed on are traced back into rings along their edges: that traced
 * ring is the area from then on. It costs one pass and it buys the whole of the exactness. Every edge is
 * axis-aligned and falls between two pixels, so there is no rule for what happens to a pixel an edge
 * cuts, because no edge cuts one. A pixel is inside or outside. Two areas drawn flush against each other
 * share their boundary exactly: none of their pixels are counted twice and none are missed. And the line
 * on the screen is drawn where the count changes, so what is counted is what is seen.
 *
 * The fence is the only thing worth keeping. What it encloses, what terrain that is, and whether a place
 * is inside it are worked out from the fence whenever they are asked for, so a repainted world or a moved
 * edge means a fresh answer rather than a stale one.
 *
 * Pure, and none of it knows what a map is. Drawing and terrain live in the interface.
 */

/** The grid the world is painted on: the master's own pixels, equirectangular, north-west first. */
export interface MasterGrid {
  width: number;
  height: number;
}

/** Where an area's pixels sit, so that nothing here allocates a world in order to hold a county. */
export interface PixelWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One row's worth of enclosed pixels, from column `from` to column `to`, both inside. */
export interface PixelSpan {
  row: number;
  from: number;
  to: number;
}

/** The pixels a shape encloses, a column range at a time, because an area is mostly interior. */
export interface EnclosedPixels {
  window: PixelWindow;
  spans: readonly PixelSpan[];
}

/** One piece of an area: its outline, and the holes in it. Both on the lattice, in whole pixel units. */
export interface FencePart {
  outer: LatticeRing;
  holes: readonly LatticeRing[];
}

/**
 * The boundary of an area: rings on the lattice between pixels.
 *
 * More than one part is not an error. A path that crosses itself encloses a shape with a hole in it, and
 * one that pinches off encloses two pieces; both are what was drawn, so both are kept.
 */
export interface Fence {
  readonly parts: readonly FencePart[];
}

const EMPTY_WINDOW: PixelWindow = { x: 0, y: 0, width: 0, height: 0 };

const clamp = (value: number, least: number, most: number): number =>
  value < least ? least : value > most ? most : value;

/** Every ring of a fence, outlines and holes alike. Even-odd does not care which is which. */
function allRings(fence: Fence): LatticeRing[] {
  return fence.parts.flatMap((part) => [part.outer, ...part.holes]);
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
 * The pixels a drawn path encloses, by the even-odd rule, taking a pixel when the path covers its centre.
 *
 * This is `fillPolygon`'s rule, in pixel coordinates over a window rather than in longitude and latitude
 * over a whole raster, so that an area the size of a county does not allocate a world to be counted in.
 * It is deliberately the same rule and deliberately a separate function: `fillPolygon`'s is baked into
 * every coastline of the generated world and may not move, and a test holds the two to each other.
 *
 * No tie-break is needed here and none is invented. This pass only has to turn a wiggle into some set of
 * whole pixels; the exactness comes afterwards, from `fenceAround`.
 *
 * Anything with area gets at least the pixel it sits in, as `fillPolygon` does, so an area drawn smaller
 * than a pixel exists rather than vanishing. That is the one case where two areas can claim one pixel.
 *
 * Throws rather than allocating when the path covers more of the world than `mostPixels`.
 */
export function enclose(path: Ring, grid: MasterGrid, mostPixels: number): EnclosedPixels {
  const edges: { x0: number; y0: number; x1: number; y1: number }[] = [];
  let leftmost = Infinity;
  let rightmost = -Infinity;
  let topmost = Infinity;
  let bottommost = -Infinity;

  for (let index = 0; index < path.length; index += 1) {
    const from = path[index]!;
    const to = path[(index + 1) % path.length]!;
    const a = toPixel({ lng: from[0], lat: from[1] }, grid);
    const b = toPixel({ lng: to[0], lat: to[1] }, grid);
    leftmost = Math.min(leftmost, a.x);
    rightmost = Math.max(rightmost, a.x);
    topmost = Math.min(topmost, a.y);
    bottommost = Math.max(bottommost, a.y);
    if (a.y === b.y) {
      continue; // A horizontal edge crosses no scanline centre.
    }
    edges.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y });
  }

  if (path.length === 0 || leftmost === Infinity) {
    return { window: EMPTY_WINDOW, spans: [] };
  }

  // Every pixel the path could possibly take: the ones whose centre its own extent reaches. Wider than
  // the answer by up to a row, which is why it is the guard rather than the window: the cap has to be
  // met before anything is scanned, and the window has to be exactly where the pixels turned out to be.
  const left = clamp(Math.ceil(leftmost - 0.5), 0, grid.width - 1);
  const right = clamp(Math.floor(rightmost - 0.5), 0, grid.width - 1);
  const top = clamp(Math.floor(topmost), 0, grid.height - 1);
  const bottom = clamp(Math.ceil(bottommost), 0, grid.height - 1);

  const reach = (right - left + 1) * (bottom - top + 1);
  if (reach > mostPixels) {
    const size = `${right - left + 1} by ${bottom - top + 1}`;
    throw new Error(`an area of ${size} pixels is ${reach}, past the ${mostPixels} this counts up to`);
  }

  const spans: PixelSpan[] = [];
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
      const from = Math.max(left, Math.ceil(crossings[pair]! - 0.5));
      const to = Math.min(right, Math.floor(crossings[pair + 1]! - 0.5));
      if (from <= to) {
        spans.push({ row, from, to });
      }
    }
  }

  if (spans.length === 0) {
    // Too small, or too unluckily placed, to cover a pixel centre. It was drawn, so it gets a pixel.
    const first = path[0]!;
    const { x, y } = toPixel({ lng: first[0], lat: first[1] }, grid);
    const column = clamp(Math.floor(x), 0, grid.width - 1);
    const row = clamp(Math.floor(y), 0, grid.height - 1);
    const only: PixelSpan = { row, from: column, to: column };
    return { window: { x: column, y: row, width: 1, height: 1 }, spans: [only] };
  }

  // Where the pixels actually turned out to be, which is the same box `fenceWindow` reports for the
  // fence built from them. Anything looser would allocate a row of nothing and count it against the cap.
  let takenLeft = Infinity;
  let takenRight = -Infinity;
  for (const span of spans) {
    takenLeft = Math.min(takenLeft, span.from);
    takenRight = Math.max(takenRight, span.to);
  }
  const firstRow = spans[0]!.row;
  const lastRow = spans[spans.length - 1]!.row;

  return {
    window: {
      x: takenLeft,
      y: firstRow,
      width: takenRight - takenLeft + 1,
      height: lastRow - firstRow + 1,
    },
    spans,
  };
}

/** Whether a traced ring is an outline rather than a hole, which is what its signed area says. */
function isOuter(ring: LatticeRing): boolean {
  // Steps are emitted with the pixels on one consistent side, and the lattice runs south as y grows, so
  // an outline comes out negative and a hole positive. One pixel traced as one square pins this down.
  return doubleSignedArea(ring) < 0;
}

/** Whether a pixel is inside one ring. Even-odd, and every edge of a fence is axis-aligned. */
function insideRing(ring: LatticeRing, x: number, y: number): boolean {
  let inside = false;
  for (let index = 0; index + 1 < ring.length; index += 1) {
    const from = ring[index]!;
    const to = ring[index + 1]!;
    if (from.x !== to.x) {
      continue; // A horizontal edge sits on a lattice line, and no pixel centre is on one.
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
 * Without this a rectangle a thousand pixels wide would be four thousand vertices instead of five.
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
 * The fence around a set of pixels: the walk along their edges, chained into closed rings.
 *
 * `traceClass` is the same walk a coastline is traced with, so a fence and a coast are the same kind of
 * thing drawn from the same lattice. Holes and separate pieces come out of it already, and are kept.
 */
export function fenceAround(enclosed: EnclosedPixels): Fence {
  const { window, spans } = enclosed;
  if (window.width <= 0 || window.height <= 0 || spans.length === 0) {
    return { parts: [] };
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
    // Back into the grid's own lattice: the mask only ever knew about its window.
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

  return { parts };
}

/** The smallest window holding a fence: where its pixels are, without counting any of them. */
export function fenceWindow(fence: Fence): PixelWindow {
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
  // Lattice lines bound pixels, so the pixels run from the first line up to but not including the last.
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The pixels a fence encloses. Exact, and this is where that is won.
 *
 * Every edge is axis-aligned on the lattice, so a scanline through a row of pixel centres meets only
 * vertical edges, and it meets them at whole numbers. A crossing at column `c` opens at pixel `c` and the
 * next one closes at pixel `c - 1`: the boundary falls between two pixels and each pixel belongs to
 * exactly one side of it. No edge passes through a pixel, so there is nothing to decide.
 */
export function enclosedBy(fence: Fence): EnclosedPixels {
  const window = fenceWindow(fence);
  if (window.width <= 0 || window.height <= 0) {
    return { window: EMPTY_WINDOW, spans: [] };
  }

  const rings = allRings(fence);
  const spans: PixelSpan[] = [];
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

  return { window, spans };
}

/** How many pixels a fence encloses. The number an area is asked for first. */
export function fenceSize(fence: Fence): number {
  let total = 0;
  for (const span of enclosedBy(fence).spans) {
    total += span.to - span.from + 1;
  }
  return total;
}

/** Whether a pixel is inside a fence. Even-odd, so it agrees with `enclosedBy` on every pixel. */
export function insideFence(fence: Fence, x: number, y: number): boolean {
  let inside = false;
  for (const ring of allRings(fence)) {
    if (insideRing(ring, x, y)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * A fence in longitude and latitude, ready to be drawn: one polygon a part, its outline then its holes.
 *
 * That is GeoJSON's own order, so the result can be handed to a map without rearranging.
 */
export function fenceToPolygons(fence: Fence, grid: MasterGrid): [number, number][][][] {
  return fence.parts.map((part) =>
    [part.outer, ...part.holes].map((ring) => ring.map((point) => toLngLat(point, grid))),
  );
}

/** How round a ring drawn as a circle is. Enough that a staircase of master pixels is what shows. */
const AROUND = 72;

/**
 * The most pixels one area drawn round a point may enclose: a six-hundred-pixel reach or so, some seven
 * hundred kilometres.
 *
 * An absolute ceiling rather than a multiple of what was asked for, because a cap that grows with the
 * reach refuses nothing. Nothing in the game comes near it; a reach with a zero too many in it does.
 */
export const MOST_ENCLOSED = 1_200_000;

/**
 * The area a fixed reach out from a point, fenced like any other.
 *
 * This is the technical shape and nothing more. What it *means* is the caller's business: today it is the
 * ground a house holds about its seat, and later it is as easily a castle's influence zone or the reach of
 * a mine. Giving it a name of its own is what lets the flavour change without the geometry moving.
 *
 * The circle is drawn in pixel space rather than in degrees, so it is round on the master and stays the
 * same size in kilometres wherever it is. In longitude and latitude the same ring would be an ellipse that
 * grew towards the poles, which is a fact about the projection and not about the place.
 *
 * It lands on the lattice between master pixels for the reason every area does: a pixel is inside or
 * outside, two areas drawn flush share their boundary exactly, and the line is where the count changes.
 * Worked out when it is asked for rather than stored, so a repainted world or a changed reach gives a
 * fresh answer. See decision record 0032.
 */
export function areaAround(centre: LngLat, grid: MasterGrid, reach: number): Fence {
  const middle = toPixel(centre, grid);
  const ring: [number, number][] = [];

  for (let step = 0; step < AROUND; step += 1) {
    const turn = (step / AROUND) * 2 * Math.PI;
    const at = lngLatOfPixel(
      middle.x + Math.cos(turn) * reach - 0.5,
      middle.y + Math.sin(turn) * reach - 0.5,
      grid,
    );
    ring.push([at.lng, at.lat]);
  }

  return fenceAround(enclose(closePath(ring) as Ring, grid, MOST_ENCLOSED));
}

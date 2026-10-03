import type { ClassRaster } from './master.ts';
import {
  Ints,
  LAKE,
  RIVER,
  SEA,
  find,
  growOverLand,
  labelWater,
  neighbours,
  walkToWater,
} from './waterPieces.ts';

export { RIVER };

/**
 * Mends the breaks in a master's rivers: paints as few land pixels as it can to river, so that every piece
 * of river is joined to the sea through water that touches side to side. A corner is not a join.
 *
 * Water is cut into pieces, each one the water you can swim through without crossing land. Every piece that
 * touches the sea is the sea. Each piece grows over land up to `maxGap` pixels, every land pixel owned by the
 * nearest piece, and where two growths meet is the cheapest bridge between those two pieces. Taking bridges
 * cheapest first and only between pieces not yet joined gives the fewest pixels for the joins it makes (the
 * spanning tree of Mehlhorn's construction). A lake is only a stepping stone: a bridge that leads to nothing
 * but lakes is dropped again. Rivers no bridge within `maxGap` takes to the sea are left as they are and
 * named, because most of them are rivers that really do end inland.
 *
 * A bridge, once painted, is water too, and can bring a river within reach of the sea that was out of it.
 * So it is done again on what it painted, until a pass joins nothing, and running it a second time paints
 * nothing.
 */

export interface MendOptions {
  /** The longest bridge painted, in land pixels. */
  maxGap: number;
}

export interface Bridge {
  /** Land pixels it paints, before any are shared with another bridge. */
  cost: number;
  /** A pixel on it, as an index into the raster. */
  at: number;
}

/** River pieces still cut off from the sea after mending, joined to each other as far as they could be. */
export interface Stranded {
  riverPixels: number;
  /** A river pixel of it, as an index into the raster. */
  at: number;
}

export interface MendReport {
  /** Pixel indices painted to river, ascending. Every one of them was land. */
  painted: Int32Array;
  bridges: Bridge[];
  /** Largest first. */
  stranded: Stranded[];
  /** The river pixels of the stranded pieces, painted ones included, ascending. */
  strandedPixels: Int32Array;
  riverPieces: number;
  riverPiecesAtSeaBefore: number;
  riverPiecesAtSeaAfter: number;
  /** How many times it went over the world: once more than it painted, to see that nothing was left. */
  passes: number;
}

interface Pass {
  painted: Int32Array;
  bridges: Bridge[];
  stranded: Stranded[];
  strandedPixels: Int32Array;
  riverPieces: number;
  riverPiecesAtSea: number;
  /** A pixel of every river piece that did not already touch the sea. */
  inland: Int32Array;
}

function mendOnce(raster: ClassRaster, maxGap: number): Pass {
  const { width, height, cells } = raster;
  const labels = new Int32Array(cells.length);
  const water = labelWater(raster, labels);
  const distance = new Uint8Array(cells.length);
  growOverLand(raster, labels, distance, maxGap);

  // Kruskal, a cost at a time, so that no candidate has to be kept: each pass joins what that cost can.
  const parent = new Int32Array(water.nodes).map((_, node) => node);
  const from = new Ints();
  const to = new Ints();
  const costs = new Ints();
  const starts = new Ints();
  const ends = new Ints();
  const around = new Int32Array(4);
  for (let cost = 1; cost <= maxGap; cost += 1) {
    for (let index = 0; index < cells.length; index += 1) {
      const level = distance[index]!;
      if (level === 0 || level > cost) {
        continue;
      }
      const owner = labels[index]!;
      neighbours(index, width, height, around);
      for (let side = 0; side < 4; side += 1) {
        const near = around[side]!;
        if (near < 0) {
          continue;
        }
        const other = labels[near]!;
        if (other === 0 || other === owner) {
          continue;
        }
        const isWater = cells[near]! <= RIVER;
        // Land meets land from both sides; only the east and south look, so each meeting is seen once.
        if (isWater ? level !== cost : side % 2 === 0 || level + distance[near]! !== cost) {
          continue;
        }
        const a = find(parent, owner);
        const b = find(parent, other);
        if (a === b) {
          continue;
        }
        parent[Math.max(a, b)] = Math.min(a, b);
        from.push(owner);
        to.push(other);
        costs.push(cost);
        starts.push(index);
        ends.push(isWater ? -1 : near);
      }
    }
  }

  // Drop the bridges that lead only to lakes, from the leaves inwards.
  const edges = costs.length;
  const degree = new Int32Array(water.nodes);
  for (let edge = 0; edge < edges; edge += 1) {
    degree[from.data[edge]!]! += 1;
    degree[to.data[edge]!]! += 1;
  }
  const offsets = new Int32Array(water.nodes + 1);
  for (let node = 0; node < water.nodes; node += 1) {
    offsets[node + 1] = offsets[node]! + degree[node]!;
  }
  const filled = offsets.slice(0, water.nodes);
  const incident = new Int32Array(edges * 2);
  for (let edge = 0; edge < edges; edge += 1) {
    incident[filled[from.data[edge]!]!++] = edge;
    incident[filled[to.data[edge]!]!++] = edge;
  }
  const dropped = new Uint8Array(edges);
  const needed = (node: number) => node === SEA || water.hasRiver[node] === 1;
  const leaves = new Ints();
  for (let node = SEA; node < water.nodes; node += 1) {
    if (degree[node] === 1 && !needed(node)) {
      leaves.push(node);
    }
  }
  for (let at = 0; at < leaves.length; at += 1) {
    const leaf = leaves.data[at]!;
    for (let slot = offsets[leaf]!; slot < offsets[leaf + 1]!; slot += 1) {
      const edge = incident[slot]!;
      if (dropped[edge] === 1) {
        continue;
      }
      dropped[edge] = 1;
      const other = from.data[edge] === leaf ? to.data[edge]! : from.data[edge]!;
      degree[other]! -= 1;
      if (degree[other] === 1 && !needed(other)) {
        leaves.push(other);
      }
    }
  }

  const walked = new Ints();
  const bridges: Bridge[] = [];
  for (let edge = 0; edge < edges; edge += 1) {
    if (dropped[edge] === 1) {
      continue;
    }
    walkToWater(starts.data[edge]!, raster, labels, distance, walked);
    if (ends.data[edge]! >= 0) {
      walkToWater(ends.data[edge]!, raster, labels, distance, walked);
    }
    bridges.push({ cost: costs.data[edge]!, at: starts.data[edge]! });
  }
  const painted = Int32Array.from(new Set(walked.view())).sort();

  const sea = find(parent, SEA);
  const inland = new Ints();
  const strandedOf = new Map<number, Stranded>();
  for (let node = SEA + 1; node < water.nodes; node += 1) {
    if (water.hasRiver[node] !== 1) {
      continue;
    }
    inland.push(water.firstPixel[node]!);
    const root = find(parent, node);
    if (root === sea) {
      continue;
    }
    const system = strandedOf.get(root) ?? { riverPixels: 0, at: water.firstPixel[node]! };
    system.riverPixels += water.riverPixels[node]!;
    strandedOf.set(root, system);
  }
  const strandedPixels = new Ints();
  for (let index = 0; index < cells.length; index += 1) {
    if (cells[index] === RIVER && find(parent, labels[index]!) !== sea) {
      strandedPixels.push(index);
    }
  }

  return {
    painted,
    bridges,
    stranded: [...strandedOf.values()].sort((a, b) => b.riverPixels - a.riverPixels),
    strandedPixels: strandedPixels.view().slice(),
    riverPieces: water.riverPieces,
    riverPiecesAtSea: water.riverPiecesAtSea,
    inland: inland.view().slice(),
  };
}

/** Whether a sorted list holds a value. */
function holds(sorted: Int32Array, value: number): boolean {
  let low = 0;
  let high = sorted.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const at = sorted[middle]!;
    if (at === value) {
      return true;
    }
    if (at < value) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return false;
}

export function mendRivers(raster: ClassRaster, { maxGap }: MendOptions): MendReport {
  if (!Number.isInteger(maxGap) || maxGap < 1 || maxGap > 255) {
    throw new Error(`the longest bridge must be a whole number of pixels from 1 to 255, not ${maxGap}`);
  }
  const working: ClassRaster = { ...raster, cells: raster.cells.slice() };
  const first = mendOnce(working, maxGap);
  const painted: Int32Array[] = [];
  const bridges: Bridge[] = [];
  let last = first;
  while (last.painted.length > 0) {
    painted.push(last.painted);
    for (const bridge of last.bridges) {
      bridges.push(bridge);
    }
    for (const index of last.painted) {
      working.cells[index] = RIVER;
    }
    last = mendOnce(working, maxGap);
  }

  const all = new Int32Array(painted.reduce((sum, pass) => sum + pass.length, 0));
  let at = 0;
  for (const pass of painted) {
    all.set(pass, at);
    at += pass.length;
  }
  const cutOff = first.inland.filter((index) => holds(last.strandedPixels, index)).length;
  return {
    painted: all.sort(),
    bridges,
    stranded: last.stranded,
    strandedPixels: last.strandedPixels,
    riverPieces: first.riverPieces,
    riverPiecesAtSeaBefore: first.riverPiecesAtSea,
    riverPiecesAtSeaAfter: first.riverPieces - cutOff,
    passes: painted.length + 1,
  };
}

export interface Nearest {
  /** Land pixels between them, the lakes on the way crossed for free. */
  gap: number;
  /** The nearest water that reaches the sea, as an index into the raster. */
  at: number;
}

/**
 * How far a stranded river is from water that reaches the sea, and where that water is: the gap to paint by
 * hand, if it should be painted at all. Searched outwards from one of its pixels, its own river and every
 * lake crossed for free, up to `limit` pixels of land.
 */
export function nearestSeaWater(
  raster: ClassRaster,
  strandedPixels: Int32Array,
  from: number,
  limit: number,
): Nearest | null {
  const { width, height, cells } = raster;
  const seen = new Uint8Array(cells.length);
  const around = new Int32Array(4);
  let level = [from];
  seen[from] = 1;
  for (let gap = 0; gap <= limit && level.length > 0; gap += 1) {
    const further: number[] = [];
    for (let at = 0; at < level.length; at += 1) {
      const index = level[at]!;
      neighbours(index, width, height, around);
      for (const near of around) {
        if (near < 0 || seen[near] === 1) {
          continue;
        }
        seen[near] = 1;
        const terrain = cells[near]!;
        if (terrain < LAKE || (terrain === RIVER && !holds(strandedPixels, near))) {
          return { gap, at: near };
        }
        (terrain <= RIVER ? level : further).push(near);
      }
    }
    level = further;
  }
  return null;
}

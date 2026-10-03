import type { ClassRaster } from './raster.ts';

/**
 * The water of a master cut into pieces, and grown out over the land around it: the ground `mendRivers`
 * builds its bridges on. A piece is the water you can swim through without crossing land, side to side and
 * never corner to corner. The ids are the palette's, `world/palette.json`: the sea is ocean and shallow sea,
 * then lake, then river, and everything after is land.
 */

const SHALLOW_SEA = 1;
export const LAKE = 2;
export const RIVER = 3;

const HAS_SEA = 1;
const HAS_RIVER = 2;

/** The node every piece touching the sea becomes. Land is 0. */
export const SEA = 1;
/** What a sea pixel is labelled while the rivers and lakes are still being cut into pieces. */
const OPEN_SEA = -1;

export class Ints {
  data = new Int32Array(1024);
  length = 0;
  push(value: number): void {
    if (this.length === this.data.length) {
      const grown = new Int32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    this.data[this.length++] = value;
  }
  view(): Int32Array {
    return this.data.subarray(0, this.length);
  }
}

export function find(parent: Int32Array, node: number): number {
  let root = node;
  while (parent[root] !== root) {
    root = parent[root]!;
  }
  while (parent[node] !== root) {
    const next = parent[node]!;
    parent[node] = root;
    node = next;
  }
  return root;
}

/** The four neighbours of a pixel, -1 past the poles. East and west wrap, because the world does. */
export function neighbours(index: number, width: number, height: number, into: Int32Array): void {
  const x = index % width;
  const y = (index - x) / width;
  into[0] = x === 0 ? index + width - 1 : index - 1;
  into[1] = x === width - 1 ? index - width + 1 : index + 1;
  into[2] = y === 0 ? -1 : index - width;
  into[3] = y === height - 1 ? -1 : index + width;
}

/**
 * Labels every water pixel with its node: SEA for the sea and for every piece touching it, 2 and up for the
 * rest. The sea is not cut into pieces, because all of it is one place to reach; rivers and lakes are, with
 * two passes and a union-find, so that half a billion pixels are each visited twice. A river that touches
 * the sea is still counted as a piece of its own, so that the counts say how many rivers were joined.
 */
export function labelWater(raster: ClassRaster, labels: Int32Array) {
  const { width, height, cells } = raster;
  let parent = new Int32Array(1 << 16);
  let flags = new Uint8Array(1 << 16);
  let next = 1;
  const union = (a: number, b: number) => {
    const ra = find(parent, a);
    const rb = find(parent, b);
    if (ra !== rb) {
      parent[Math.max(ra, rb)] = Math.min(ra, rb);
    }
  };
  // Every pair of neighbours is met once, from the later of the two, so the sea marks whichever came first.
  const meet = (label: number, other: number) => {
    if (label === OPEN_SEA && other > 0) {
      flags[other]! |= HAS_SEA;
    } else if (label > 0 && other === OPEN_SEA) {
      flags[label]! |= HAS_SEA;
    } else if (label > 0 && other > 0 && label !== other) {
      union(label, other);
    }
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const terrain = cells[index]!;
      if (terrain > RIVER) {
        continue;
      }
      const left = x > 0 ? labels[index - 1]! : 0;
      const up = y > 0 ? labels[index - width]! : 0;
      let label = OPEN_SEA;
      if (terrain > SHALLOW_SEA) {
        label = left > 0 ? left : up > 0 ? up : 0;
        if (label === 0) {
          if (next === parent.length) {
            const grownParent = new Int32Array(parent.length * 2);
            grownParent.set(parent);
            parent = grownParent;
            const grownFlags = new Uint8Array(flags.length * 2);
            grownFlags.set(flags);
            flags = grownFlags;
          }
          label = next++;
          parent[label] = label;
        }
        if (terrain === RIVER) {
          flags[label]! |= HAS_RIVER;
        }
      }
      labels[index] = label;
      meet(label, left);
      meet(label, up);
    }
  }
  for (let y = 0; y < height; y += 1) {
    meet(labels[y * width]!, labels[y * width + width - 1]!);
  }

  for (let label = 1; label < next; label += 1) {
    const root = find(parent, label);
    flags[root]! |= flags[label]!;
  }
  const nodeOfRoot = new Int32Array(next);
  let nodes = SEA + 1;
  let riverPieces = 0;
  let riverPiecesAtSea = 0;
  for (let label = 1; label < next; label += 1) {
    if (parent[label] !== label) {
      continue;
    }
    const flag = flags[label]!;
    if (flag & HAS_RIVER) {
      riverPieces += 1;
      if (flag & HAS_SEA) {
        riverPiecesAtSea += 1;
      }
    }
    nodeOfRoot[label] = flag & HAS_SEA ? SEA : nodes++;
  }
  const hasRiver = new Uint8Array(nodes);
  const riverPixels = new Int32Array(nodes);
  const firstPixel = new Int32Array(nodes).fill(-1);
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index]!;
    if (label === 0) {
      continue;
    }
    const node = label === OPEN_SEA ? SEA : nodeOfRoot[find(parent, label)]!;
    labels[index] = node;
    if (cells[index] === RIVER) {
      hasRiver[node] = 1;
      riverPixels[node]! += 1;
      if (firstPixel[node] === -1) {
        firstPixel[node] = index;
      }
    }
  }
  return { nodes, hasRiver, riverPixels, firstPixel, riverPieces, riverPiecesAtSea };
}

/**
 * Grows every piece over land, a ring at a time, up to `maxGap` rings. A land pixel takes the label of the
 * piece that reached it first and records how many land pixels lie between it and that piece, itself
 * included.
 */
export function growOverLand(
  raster: ClassRaster,
  labels: Int32Array,
  distance: Uint8Array,
  maxGap: number,
): void {
  const { width, height, cells } = raster;
  const around = new Int32Array(4);
  let ring = new Ints();
  for (let index = 0; index < cells.length; index += 1) {
    if (cells[index]! <= RIVER) {
      continue;
    }
    neighbours(index, width, height, around);
    for (const near of around) {
      if (near >= 0 && cells[near]! <= RIVER) {
        labels[index] = labels[near]!;
        distance[index] = 1;
        ring.push(index);
        break;
      }
    }
  }
  for (let level = 2; level <= maxGap; level += 1) {
    const grown = new Ints();
    const from = ring.view();
    for (const index of from) {
      neighbours(index, width, height, around);
      for (const near of around) {
        if (near >= 0 && distance[near] === 0 && cells[near]! > RIVER) {
          labels[near] = labels[index]!;
          distance[near] = level;
          grown.push(near);
        }
      }
    }
    ring = grown;
  }
}

/** Walks from a land pixel back down the grown distances to the water it was grown from. */
export function walkToWater(
  start: number,
  raster: ClassRaster,
  labels: Int32Array,
  distance: Uint8Array,
  into: Ints,
) {
  const around = new Int32Array(4);
  let index = start;
  for (;;) {
    into.push(index);
    const level = distance[index]!;
    if (level === 1) {
      return;
    }
    neighbours(index, raster.width, raster.height, around);
    const owner = labels[index];
    const down = around.find((near) => near >= 0 && distance[near] === level - 1 && labels[near] === owner);
    if (down === undefined) {
      throw new Error(`pixel ${index} was grown from nowhere`);
    }
    index = down;
  }
}

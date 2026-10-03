import { CostHeap } from './costHeap.ts';
import type { ClassRaster } from './raster.ts';

/**
 * WIP SPIKE: which way the rivers run, worked out from the master and nothing else, so it follows whatever is
 * painted in it.
 *
 * Water runs to the sea. Every river and lake pixel is given its shortest way there along the water, walking
 * inland from the coast, and the neighbour a pixel was reached from is the one downstream of it. Pixels that
 * touch are joined, corners included, because a river a pixel wide steps diagonally as often as not.
 *
 * **The master's rivers have two kinds of fault, and neither is trusted absolutely.** A river has breaks in it,
 * a pixel or a few; and two rivers' heads touch across a watershed where they should not. So a river end may
 * jump a gap to water a few pixels away, at a price: a pixel of gap costs as much as `jumpCost` pixels of river,
 * and three times that onto the middle of another river rather than its end, because a break in a river has an
 * end on both sides and a tributary's source near another river does not. Then a short break beats a long
 * detour through a touch into the next basin, which is how the upper Elbe once ran out through the Danube, and a
 * source is not lightly captured by the river beside it.
 *
 * What is still unreached runs into a lake with no way out big enough to be an inland sea, as the rivers of the
 * Great Basin do, and what is left after that is stranded: it has no way to any sea or lake, and stays still.
 */

/** How a network pixel was reached: not at all, from the sea, across a gap, or into an inland lake. */
export const STRANDED = 0;
export const FROM_SEA = 1;
export const ACROSS_GAP = 2;
export const INLAND = 3;

export interface WaterClasses {
  sea: ReadonlySet<number>;
  lake: ReadonlySet<number>;
  river: ReadonlySet<number>;
}

export interface FlowOptions {
  /** The longest gap a river may jump, in pixels. */
  bridge?: number;
  /** How many pixels downstream a river's direction is taken towards, which smooths its staircase. */
  along?: number;
  /** How many pixels of river one pixel of gap costs: what a jump must save to be taken. */
  jumpCost?: number;
  /** Whether the raster joins round east to west, as the world does. */
  wraps?: boolean;
  /**
   * Whether lengths are measured on the map, where a pixel of the master is taller than it is wide by the
   * secant of its latitude, so they are world units; or in plain pixels.
   */
  mercator?: boolean;
  /**
   * The fewest pixels a lake needs to be an inland sea a river may end in. A dot of a lake on a river with a
   * break below it is not one, or the river between the two would run backwards into it.
   */
  inlandLake?: number;
}

export interface RiverFlow {
  width: number;
  height: number;
  /** Every river and lake pixel, by its index in the raster, in ascending order. */
  pixels: Int32Array;
  /** Which way each flows, a unit vector in master pixels, east and south; nought for lakes and the stranded. */
  east: Float32Array;
  south: Float32Array;
  /** How many network pixels drain through each, itself included: how big a river it is. */
  upstream: Float64Array;
  /** How each was reached: `STRANDED`, `FROM_SEA`, `ACROSS_GAP` or `INLAND`. */
  reached: Uint8Array;
  /** Whether each is a river rather than a lake. */
  isRiver: Uint8Array;
  /** Whether each is a pixel of an inland sea, where a river with no way to the sea ends. */
  isSink: Uint8Array;
  /** Every gap a river jumped, as the pixel it jumped from and the pixel it landed on, flattened. */
  gaps: number[];
  /**
   * How far each lies from where its water ends, the sea or an inland lake, along the water, in world units: a
   * coordinate running down every river round its bends. A jump adds its price, so it steps at a gap.
   */
  along: Float64Array;
  /** The network pixel downstream of each; below -1 the sea pixel -2 - it, and -1 for none. */
  down: Int32Array;
  /** The network pixel at a raster index, or -1. */
  nodeAt(pixel: number): number;
}

// Land is nought: every other class is one of these.
const SEA = 1;
const LAKE = 2;
const RIVER = 3;

export function riverFlow(raster: ClassRaster, classes: WaterClasses, options: FlowOptions = {}): RiverFlow {
  const bridge = options.bridge ?? 6;
  const along = options.along ?? 6;
  const wraps = options.wraps ?? true;
  const inlandLake = options.inlandLake ?? 50;
  const JUMP = options.jumpCost ?? 50;
  const mercator = options.mercator ?? true;
  const { width, height, cells } = raster;

  // How much taller than wide a pixel of each row is on the map.
  const stretch = new Float64Array(height);
  for (let row = 0; row < height; row += 1) {
    const latitude = Math.min(85, Math.abs(90 - ((row + 0.5) / height) * 180));
    stretch[row] = mercator ? 1 / Math.cos((latitude * Math.PI) / 180) : 1;
  }
  /** How long a step so far across and down from a pixel is on the map. */
  const step = (pixel: number, across: number, down: number) =>
    Math.hypot(across, down * stretch[Math.floor(pixel / width)]!);

  const kindOf = new Uint8Array(256);
  for (const id of classes.sea) kindOf[id] = SEA;
  for (const id of classes.lake) kindOf[id] = LAKE;
  for (const id of classes.river) kindOf[id] = RIVER;

  // The network, found in one pass and looked up by row.
  let count = 0;
  for (let at = 0; at < cells.length; at += 1) {
    if (kindOf[cells[at]!]! >= LAKE) count += 1;
  }
  const pixels = new Int32Array(count);
  const rowStart = new Int32Array(height + 1);
  const isRiver = new Uint8Array(count);
  let next = 0;
  for (let row = 0; row < height; row += 1) {
    rowStart[row] = next;
    const line = row * width;
    for (let column = 0; column < width; column += 1) {
      const kind = kindOf[cells[line + column]!]!;
      if (kind >= LAKE) {
        isRiver[next] = kind === RIVER ? 1 : 0;
        pixels[next++] = line + column;
      }
    }
  }
  rowStart[height] = next;

  const nodeAt = (pixel: number): number => {
    const row = Math.floor(pixel / width);
    let low = rowStart[row]!;
    let high = rowStart[row + 1]! - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const value = pixels[middle]!;
      if (value === pixel) return middle;
      if (value < pixel) low = middle + 1;
      else high = middle - 1;
    }
    return -1;
  };
  /** The raster index so far across and down from a pixel, round the world east and west, or -1 off it. */
  const offset = (pixel: number, across: number, down: number): number => {
    const row = Math.floor(pixel / width) + down;
    if (row < 0 || row >= height) return -1;
    let column = (pixel % width) + across;
    if (column < 0 || column >= width) {
      if (!wraps) return -1;
      column = ((column % width) + width) % width;
    }
    return row * width + column;
  };

  // The ends: river pixels with at most one river neighbour, which is what both sides of a break look like.
  // Lakes beside it do not count: the master's rivers brush dots of lake all along them, and a river whose tip
  // touches one is still a river that stops there.
  const isEnd = new Uint8Array(count);
  for (let node = 0; node < count; node += 1) {
    if (isRiver[node] === 0) continue;
    const pixel = pixels[node]!;
    let along = 0;
    for (let down = -1; down <= 1; down += 1) {
      for (let across = -1; across <= 1; across += 1) {
        const near = across === 0 && down === 0 ? -1 : offset(pixel, across, down);
        if (near >= 0 && kindOf[cells[near]!]! === RIVER) along += 1;
      }
    }
    if (along <= 1) isEnd[node] = 1;
  }

  // The gaps: from every river end to the water within a jump of it.
  const jumpFrom: number[] = [];
  const jumpTo: number[] = [];
  const jumpLength: number[] = [];
  const seaJump = new Map<number, { sea: number; length: number }>();
  for (let node = 0; node < count; node += 1) {
    if (isEnd[node] === 0) continue;
    const pixel = pixels[node]!;
    for (let down = -bridge; down <= bridge; down += 1) {
      for (let across = -bridge; across <= bridge; across += 1) {
        if (Math.abs(across) <= 1 && Math.abs(down) <= 1) continue;
        if (Math.hypot(across, down) > bridge + 0.5) continue;
        const length = step(pixel, across, down);
        const far = offset(pixel, across, down);
        if (far < 0) continue;
        const kind = kindOf[cells[far]!]!;
        if (kind === SEA) {
          const best = seaJump.get(node);
          if (best === undefined || length < best.length) seaJump.set(node, { sea: far, length });
        } else if (kind >= LAKE) {
          jumpFrom.push(node);
          jumpTo.push(nodeAt(far));
          jumpLength.push(length);
        }
      }
    }
  }
  // Each jump both ways, as lists by node.
  const jumpStart = new Int32Array(count + 1);
  for (let at = 0; at < jumpFrom.length; at += 1) {
    jumpStart[jumpFrom[at]! + 1]! += 1;
    jumpStart[jumpTo[at]! + 1]! += 1;
  }
  for (let node = 0; node < count; node += 1) jumpStart[node + 1]! += jumpStart[node]!;
  const jumpOther = new Int32Array(jumpStart[count]!);
  const jumpCost = new Float64Array(jumpStart[count]!);
  const filled = jumpStart.slice(0, count);
  for (let at = 0; at < jumpFrom.length; at += 1) {
    const [a, b, length] = [jumpFrom[at]!, jumpTo[at]!, jumpLength[at]!];
    // End to end, or an end to a lake, is a break; an end onto the middle of a river is likelier a source.
    const cost = length * JUMP * (isEnd[b] === 1 || isRiver[b] === 0 ? 1 : 3);
    jumpOther[filled[a]!] = b;
    jumpCost[filled[a]!++] = cost;
    jumpOther[filled[b]!] = a;
    jumpCost[filled[b]!++] = cost;
  }

  // Shortest ways along the water. A parent below -1 is the sea pixel -2 - parent.
  const distance = new Float64Array(count).fill(Number.POSITIVE_INFINITY);
  const parent = new Int32Array(count).fill(-1);
  const reached = new Uint8Array(count);
  const settled = new Uint8Array(count);
  const order = new Int32Array(count);
  const viaJump = new Uint8Array(count);
  let settledCount = 0;
  const heap = new CostHeap();

  const offer = (node: number, cost: number, from: number, jump = false) => {
    if (settled[node] === 0 && cost < distance[node]!) {
      distance[node] = cost;
      parent[node] = from;
      viaJump[node] = jump ? 1 : 0;
      heap.push(cost, node);
    }
  };
  const spread = (pass: number) => {
    while (heap.size > 0) {
      const node = heap.pop();
      if (settled[node] === 1) continue;
      settled[node] = 1;
      reached[node] = pass;
      order[settledCount++] = node;
      const pixel = pixels[node]!;
      const cost = distance[node]!;
      for (let down = -1; down <= 1; down += 1) {
        for (let across = -1; across <= 1; across += 1) {
          if (across === 0 && down === 0) continue;
          const near = offset(pixel, across, down);
          if (near < 0 || kindOf[cells[near]!]! < LAKE) continue;
          offer(nodeAt(near), cost + step(pixel, across, down), node);
        }
      }
      for (let at = jumpStart[node]!; at < jumpStart[node + 1]!; at += 1) {
        offer(jumpOther[at]!, cost + jumpCost[at]!, node, true);
      }
    }
  };

  // From the sea: every pixel beside it, and every river end a jump from it.
  for (let node = 0; node < count; node += 1) {
    const pixel = pixels[node]!;
    for (let down = -1; down <= 1; down += 1) {
      for (let across = -1; across <= 1; across += 1) {
        const near = across === 0 && down === 0 ? -1 : offset(pixel, across, down);
        if (near >= 0 && kindOf[cells[near]!]! === SEA) {
          offer(node, step(pixel, across, down), -2 - near);
        }
      }
    }
  }
  for (const [node, { sea, length }] of seaJump) offer(node, length * JUMP, -2 - sea, true);
  spread(FROM_SEA);

  // Into the lakes that are left and big enough to be inland seas, as into a sea of their own.
  const piece = new Uint8Array(count);
  const members: number[] = [];
  for (let start = 0; start < count; start += 1) {
    if (settled[start] === 1 || isRiver[start] === 1 || piece[start] === 1) continue;
    piece[start] = 1;
    members.length = 0;
    members.push(start);
    for (let at = 0; at < members.length; at += 1) {
      const pixel = pixels[members[at]!]!;
      for (let down = -1; down <= 1; down += 1) {
        for (let across = -1; across <= 1; across += 1) {
          const near = across === 0 && down === 0 ? -1 : offset(pixel, across, down);
          if (near < 0 || kindOf[cells[near]!]! !== LAKE) continue;
          const node = nodeAt(near);
          if (piece[node] === 0 && settled[node] === 0) {
            piece[node] = 1;
            members.push(node);
          }
        }
      }
    }
    if (members.length >= inlandLake) {
      for (const node of members) offer(node, 0, -1);
    }
  }
  spread(INLAND);

  // A river that came by a jump anywhere on its way to the sea came across a gap.
  for (let at = 0; at < settledCount; at += 1) {
    const node = order[at]!;
    if (reached[node] !== FROM_SEA) continue;
    const below = parent[node]!;
    if (viaJump[node] === 1 || (below >= 0 && reached[below] === ACROSS_GAP)) reached[node] = ACROSS_GAP;
  }

  // Which way each river runs: towards the pixel `along` steps downstream of it, or the sea if that is nearer.
  const east = new Float32Array(count);
  const south = new Float32Array(count);
  const gaps: number[] = [];
  const columnOf = (pixel: number) => pixel % width;
  const rowOf = (pixel: number) => Math.floor(pixel / width);
  for (let node = 0; node < count; node += 1) {
    if (reached[node] === STRANDED) continue;
    const pixel = pixels[node]!;
    const from = parent[node]!;
    const to = from >= 0 ? pixels[from]! : from < -1 ? -2 - from : -1;
    const apart = wraps
      ? wrapped(columnOf(to) - columnOf(pixel), width)
      : Math.abs(columnOf(to) - columnOf(pixel));
    if (to >= 0 && (Math.abs(rowOf(to) - rowOf(pixel)) > 1 || apart > 1)) {
      gaps.push(pixel, to);
    }
    if (isRiver[node] === 0) continue;
    let target = -1;
    let step = node;
    for (let taken = 0; taken < along; taken += 1) {
      const up = parent[step]!;
      if (up >= 0) {
        step = up;
        target = pixels[up]!;
      } else {
        if (up < -1) target = -2 - up;
        break;
      }
    }
    if (target < 0) continue;
    let dx = columnOf(target) - columnOf(pixel);
    if (wraps && dx > width / 2) dx -= width;
    if (wraps && dx < -width / 2) dx += width;
    const dy = rowOf(target) - rowOf(pixel);
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      east[node] = dx / length;
      south[node] = dy / length;
    }
  }

  // How much drains through each: every pixel adds itself to all those below it.
  const upstream = new Float64Array(count).fill(1);
  for (let at = settledCount - 1; at >= 0; at -= 1) {
    const node = order[at]!;
    const below = parent[node]!;
    if (below >= 0) upstream[below]! += upstream[node]!;
  }

  const isSink = new Uint8Array(count);
  for (let node = 0; node < count; node += 1) {
    if (reached[node] === INLAND && parent[node] === -1) isSink[node] = 1;
  }

  return {
    width,
    height,
    pixels,
    east,
    south,
    upstream,
    reached,
    isRiver,
    isSink,
    gaps,
    along: distance,
    down: parent,
    nodeAt,
  };
}

const wrapped = (difference: number, width: number): number => {
  const across = Math.abs(difference);
  return Math.min(across, width - across);
};

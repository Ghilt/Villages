import { CostHeap } from '../costHeap.ts';
import { GROUND_LATTICE, frameOf } from '../lattice.ts';
import type { BridgeAxis } from '../settlementLooks.ts';
import { unitsAlong } from './line.ts';

/*
 * The course of a road: the cheapest way over the world's units from one place's ends to another's, a step to any of
 * the eight units about it, costing what the ground it steps onto costs and the climb, a step onto a unit already a
 * road costing less, so roads that share ground merge into trunks. Open water bars the way, and so does a corner cut
 * beside water or a river. A river is never stepped on: it is crossed only by a **bridge**, a straight run from a unit
 * of land along one of the ground lattice's four axes, both ways - the two axes and the two diagonals, eight directions
 * - over a river no longer than the longest span and small enough to bridge, onto land with land beyond it. Pure; the
 * ground is asked for through `CourseGround`. See docs/plans/settlements-and-roads.md and decision record 0115.
 */

/** What `CourseGround.cost` says of a unit that is not land: open water, a river too big to bridge, one small enough. */
export const WATER = -1;
export const RIVER = -2;
export const BRIDGEABLE = -3;

export interface CourseGround {
  /** What a step onto the unit costs beside one onto open farmland, one or more; or `WATER`, `RIVER` or `BRIDGEABLE`. */
  cost(x: number, y: number): number;
  /** How high the unit stands, in metres. */
  height(x: number, y: number): number;
  /** Whether no road may pass over the unit: a settlement's square, a ruin's piece. */
  barred(x: number, y: number): boolean;
  /** Whether the unit is a road already, which a road after it follows the more cheaply. */
  road(x: number, y: number): boolean;
}

export interface CourseRules {
  /** What a metre up or down between two units costs, in steps over farmland. */
  readonly climb: number;
  /** What a unit of bridge costs, and what building one costs at all, in steps. */
  readonly bridge: number;
  readonly bridgeAt: number;
  /** The most river a bridge spans, in world units. */
  readonly longestSpan: number;
  /** The share of a step's cost onto a unit already a road. */
  readonly trunk: number;
  /** How far past the box round its ends a course may stray, in world units. */
  readonly margin: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A bridge of a course: the point it starts from, by its place in the course's points, its axis and its span. */
export interface CourseBridge {
  readonly at: number;
  readonly axis: BridgeAxis;
  /** How long it is from end to end, in world units. */
  readonly span: number;
}

/** A course: the points it runs through from end to end, its bridges, and the units it steps on, by `unitKey`. */
export interface Course {
  readonly points: readonly Point[];
  readonly bridges: readonly CourseBridge[];
  readonly units: readonly number[];
}

/** A unit of the world by one number, the whole world's units apart. */
export function unitKey(x: number, y: number): number {
  return y * 65536 + x;
}

const FRAME = frameOf(GROUND_LATTICE);
const HALF = Math.SQRT1_2;
/** The eight ways a bridge may run, in world units: each axis of the lattice, and each diagonal, both ways. */
const WAYS: readonly { axis: BridgeAxis; dx: number; dy: number }[] = (
  [
    ['u', FRAME.cos, FRAME.sin],
    ['v', -FRAME.sin, FRAME.cos],
    ['uv', (FRAME.cos - FRAME.sin) * HALF, (FRAME.sin + FRAME.cos) * HALF],
    ['vu', (FRAME.cos + FRAME.sin) * HALF, (FRAME.sin - FRAME.cos) * HALF],
  ] as const
).flatMap(([axis, dx, dy]) => [
  { axis, dx, dy },
  { axis, dx: -dx, dy: -dy },
]);

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** A bridge out of a unit: the unit it lands in, where on the axis its far end is, its axis and its span. */
interface Crossing {
  readonly x: number;
  readonly y: number;
  readonly end: Point;
  readonly axis: BridgeAxis;
  readonly span: number;
}

/** Every bridge out of the unit at `x`, `y`, one a way at most, in the order of `WAYS`. */
export function bridgesFrom(x: number, y: number, ground: CourseGround, longestSpan: number): Crossing[] {
  const out: Crossing[] = [];
  const sx = x + 0.5;
  const sy = y + 0.5;
  const far = longestSpan + 3;
  for (const way of WAYS) {
    let phase: 'start' | 'leaving' | 'river' | 'landed' = 'start';
    let riverFrom = 0;
    let landing: { x: number; y: number; middle: number; entered: number } | null = null;
    let ok = false;
    unitsAlong(sx, sy, sx + way.dx * far, sy + way.dy * far, (ux, uy, entered, left) => {
      if (phase === 'start') {
        phase = 'leaving';
        return true;
      }
      const cost = ground.cost(ux, uy);
      if (left === entered) {
        // A unit passed only at its corner: a river is still crossed there, and open water still bars it.
        return !(phase === 'river' && (cost === WATER || cost === RIVER));
      }
      if (phase === 'leaving') {
        if (cost !== BRIDGEABLE) return false;
        phase = 'river';
        riverFrom = entered;
        return true;
      }
      if (phase === 'river') {
        if ((entered - riverFrom) * far > longestSpan) return false;
        if (cost === BRIDGEABLE) return true;
        if (cost < 1 || ground.barred(ux, uy)) return false;
        landing = { x: ux, y: uy, middle: (entered + left) / 2, entered };
        phase = 'landed';
        return true;
      }
      // The unit past the landing is land too, so a bridge never lands on a sliver between two rivers.
      ok = cost >= 1 && !ground.barred(ux, uy);
      return false;
    });
    const landed = landing as { x: number; y: number; middle: number; entered: number } | null;
    if (!ok || landed === null) continue;
    const reach = landed.middle * far;
    out.push({
      x: landed.x,
      y: landed.y,
      end: { x: sx + way.dx * reach, y: sy + way.dy * reach },
      axis: way.axis,
      span: reach,
    });
  }
  return out;
}

/**
 * The course from the nearest of `from` to the nearest of `to`, the cheapest way by `rules` over `ground`, its first
 * and last points those ends themselves; null when no way inside its box reaches. Every step tried in the same order,
 * so the same ground and rules give the same course.
 */
export function courseBetween(
  from: readonly Point[],
  to: readonly Point[],
  ground: CourseGround,
  rules: CourseRules,
): Course | null {
  const all = [...from, ...to];
  if (from.length === 0 || to.length === 0) return null;
  const xs = all.map((one) => one.x);
  const ys = all.map((one) => one.y);
  const stray =
    rules.margin + 0.25 * Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const minX = Math.floor(Math.min(...xs) - stray);
  const minY = Math.floor(Math.min(...ys) - stray);
  const width = Math.ceil(Math.max(...xs) + stray) - minX + 1;
  const height = Math.ceil(Math.max(...ys) + stray) - minY + 1;
  const size = width * height;
  const inBox = (x: number, y: number) => x >= minX && y >= minY && x < minX + width && y < minY + height;
  const nodeOf = (x: number, y: number) => (y - minY) * width + (x - minX);

  const costs = new Float32Array(size).fill(Number.NaN);
  const heights = new Float32Array(size).fill(Number.NaN);
  const costAt = (x: number, y: number, node: number) => {
    let cost = costs[node]!;
    if (Number.isNaN(cost)) {
      cost = ground.cost(x, y);
      if (cost >= 1 && ground.barred(x, y)) cost = WATER;
      costs[node] = cost;
    }
    return cost;
  };
  const heightAt = (x: number, y: number, node: number) => {
    let metres = heights[node]!;
    if (Number.isNaN(metres)) {
      metres = ground.height(x, y);
      heights[node] = metres;
    }
    return metres;
  };

  const goals = new Map<number, Point>();
  for (const end of to) {
    const x = Math.floor(end.x);
    const y = Math.floor(end.y);
    if (inBox(x, y) && costAt(x, y, nodeOf(x, y)) >= 1 && !goals.has(nodeOf(x, y)))
      goals.set(nodeOf(x, y), end);
  }
  if (goals.size === 0) return null;
  const goalPoints = [...goals.values()];
  const guess = (x: number, y: number) =>
    rules.trunk * Math.min(...goalPoints.map((end) => Math.hypot(end.x - x - 0.5, end.y - y - 0.5)));

  const spent = new Float64Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const startedAt = new Map<number, Point>();
  const bridged = new Map<number, Crossing>();
  const done = new Uint8Array(size);
  const heap = new CostHeap();
  for (const start of from) {
    const x = Math.floor(start.x);
    const y = Math.floor(start.y);
    if (!inBox(x, y)) continue;
    const node = nodeOf(x, y);
    if (costAt(x, y, node) < 1 || startedAt.has(node)) continue;
    startedAt.set(node, start);
    spent[node] = 0;
    heap.push(guess(x, y), node);
  }

  let reached = -1;
  while (heap.size > 0) {
    const node = heap.pop();
    if (done[node] === 1) continue;
    done[node] = 1;
    if (goals.has(node)) {
      reached = node;
      break;
    }
    const x = minX + (node % width);
    const y = minY + Math.floor(node / width);
    const here = costAt(x, y, node);
    const rise = heightAt(x, y, node);
    const relax = (next: number, nx: number, ny: number, cost: number, crossing: Crossing | null) => {
      const total = spent[node]! + cost;
      if (total >= spent[next]!) return;
      spent[next] = total;
      came[next] = node;
      if (crossing === null) bridged.delete(next);
      else bridged.set(next, crossing);
      heap.push(total + guess(nx, ny), next);
    };
    let besideRiver = false;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBox(nx, ny)) continue;
      const next = nodeOf(nx, ny);
      const cost = costAt(nx, ny, next);
      if (cost === BRIDGEABLE) besideRiver = true;
      if (cost < 1 || done[next] === 1) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (costAt(nx, y, nodeOf(nx, y)) < 1 || costAt(x, ny, nodeOf(x, ny)) < 1)) continue;
      const along =
        ((here + cost) / 2) * (diagonal ? Math.SQRT2 : 1) * (ground.road(nx, ny) ? rules.trunk : 1);
      relax(next, nx, ny, along + rules.climb * Math.abs(heightAt(nx, ny, next) - rise), null);
    }
    if (!besideRiver) continue;
    for (const crossing of bridgesFrom(x, y, ground, rules.longestSpan)) {
      if (!inBox(crossing.x, crossing.y)) continue;
      const next = nodeOf(crossing.x, crossing.y);
      if (done[next] === 1 || costAt(crossing.x, crossing.y, next) < 1) continue;
      const climb = rules.climb * Math.abs(heightAt(crossing.x, crossing.y, next) - rise);
      relax(next, crossing.x, crossing.y, rules.bridgeAt + rules.bridge * crossing.span + climb, crossing);
    }
  }
  if (reached < 0) return null;

  const nodes: number[] = [];
  for (let at = reached; at >= 0; at = came[at]!) nodes.push(at);
  nodes.reverse();
  const centre = (node: number): Point => ({
    x: minX + (node % width) + 0.5,
    y: minY + Math.floor(node / width) + 0.5,
  });
  const points: Point[] = [startedAt.get(nodes[0]!)!];
  const bridges: CourseBridge[] = [];
  const push = (point: Point) => {
    const last = points[points.length - 1]!;
    if (last.x !== point.x || last.y !== point.y) points.push(point);
  };
  nodes.forEach((node, at) => {
    const crossing = bridged.get(node);
    if (at > 0 && crossing !== undefined) {
      push(centre(nodes[at - 1]!));
      bridges.push({ at: points.length - 1, axis: crossing.axis, span: crossing.span });
      points.push(crossing.end);
    } else {
      push(centre(node));
    }
  });
  push(goals.get(reached)!);
  const units = nodes.map((node) => unitKey(minX + (node % width), minY + Math.floor(node / width)));
  return { points, bridges, units };
}

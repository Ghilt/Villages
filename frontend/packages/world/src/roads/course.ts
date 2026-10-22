import { CostHeap } from '../costHeap.ts';
import { GROUND_LATTICE, alongU, alongV, frameOf } from '../lattice.ts';
import type { BridgeWay } from '../bridgeModel.ts';
import { bridgesFrom } from './crossings.ts';
import { boxOf, diamondOf, diamondMiddle } from './diamonds.ts';
import type { Crossing } from './crossings.ts';
import { unitsAlong } from './line.ts';
import { onQuarter } from './shape.ts';

/*
 * The course of a road: the cheapest way over the ground's lattice from one place's ends to another's, a step from a
 * diamond to the next along one of the lattice's two axes, or at a price across one of its diagonals, so a road runs
 * along the grid the map is drawn on and not across it (Adam's word of 2026-10-22). Every turn costs, so a road keeps to
 * long straight runs and turns where the ground asks it to, and its shape rounds each turn (`shape.ts`). A step costs
 * what the ground it steps onto costs and the climb, a step onto a diamond already a road less, so roads that share
 * ground merge into trunks. Every world unit a step's line passes over must be land a road may cross: open water bars
 * the way, and so does a corner cut beside water. A river is never stepped over: it is crossed only by a **bridge**, a
 * straight run from a diamond's middle along one of the lattice's eight ways, over a river no longer than the longest
 * span and small enough to bridge, onto land with land beyond it; one along an axis costs least. Pure; the ground is
 * asked for through `CourseGround`. See docs/plans/settlements-and-roads.md and decision record 0115.
 */

/** What `CourseGround.cost` says of a unit that is not land: open water, a river too big to bridge, one small enough. */
export const WATER = -1;
export const RIVER = -2;
export const BRIDGEABLE = -3;

export interface CourseGround {
  /** What a step onto the world unit costs beside one onto open farmland, one or more; or `WATER`, `RIVER` or `BRIDGEABLE`. */
  cost(x: number, y: number): number;
  /** How high the world unit stands, in metres. */
  height(x: number, y: number): number;
  /** Whether no road may pass over the world unit: a settlement's square, a ruin's piece. */
  barred(x: number, y: number): boolean;
  /** Whether the lattice's diamond `u`, `v` is a road already, which a road after it follows the more cheaply. */
  road(u: number, v: number): boolean;
}

export interface CourseRules {
  /** What a metre up or down between two diamonds costs, in steps over farmland. */
  readonly climb: number;
  /** What a unit of bridge costs, and what building one costs at all, in steps. */
  readonly bridge: number;
  readonly bridgeAt: number;
  /** The most river a bridge spans, in world units. */
  readonly longestSpan: number;
  /** The share of a step's cost onto a diamond already a road. */
  readonly trunk: number;
  /** How far past the box round its ends a course may stray, in world units. */
  readonly margin: number;
  /** What a turn costs, in steps over farmland: the more, the longer a road's straight runs. */
  readonly turn: number;
  /** What a step across a diagonal costs beside one along an axis: above two, it is taken only where it must be. */
  readonly diagonal: number;
  /**
   * How far either side of the plainest way, in diamonds, a road may go to keep to long straight runs: the wider, the
   * wider its zigzags.
   */
  readonly corridor: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A bridge of a course: the point it starts from, by its place in the course's points, its axis and its span. */
export interface CourseBridge {
  readonly at: number;
  readonly axis: BridgeWay;
  /** How long it is from end to end, in world units. */
  readonly span: number;
}

/** A bridge as a course lands it: the place of the diamond it lands in among the course's units, and its far end. */
export interface Landing {
  readonly at: number;
  readonly axis: BridgeWay;
  readonly span: number;
  readonly end: Point;
}

/**
 * A course: the points it runs through from end to end, in world units, its bridges, the lattice's diamonds it steps
 * on, by `unitKey` of their two whole numbers, from end to end, and which of them a bridge lands in.
 */
export interface Course {
  readonly points: readonly Point[];
  readonly bridges: readonly CourseBridge[];
  readonly units: readonly number[];
  readonly landings: readonly Landing[];
}

// Two whole numbers in one, every one apart, a world's width either side of them too, so a course that steps across
// the world's edge at a longitude of 180 is still read back where it went: a world unit, or a diamond of the lattice.
const OFFSET = 32768;
const SPAN = 131072;

export { courseReach, diamondMiddle } from './diamonds.ts';

/** A world unit, or a diamond of the lattice, by one number. */
export function unitKey(x: number, y: number): number {
  return (y + OFFSET) * SPAN + (x + OFFSET);
}

/** The two whole numbers a key is. */
export function unitOf(key: number): Point {
  return { x: (key % SPAN) - OFFSET, y: Math.floor(key / SPAN) - OFFSET };
}

const FRAME = frameOf(GROUND_LATTICE);

/** The eight steps of the lattice, the two axes both ways first and then the diagonals; and none, to begin with. */
const STEPS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
] as const;
const NONE = STEPS.length;
/** What a diamond's distance off the straight line between the ends costs on the plain way, so it keeps near it. */
const STRAY = 0.02;
const STATES = NONE + 1;

/** Which of the lattice's steps a bridge's way is, or none, for one halfway between them. */
function stepOfWay(du: number, dv: number): number {
  const at = STEPS.findIndex(([su, sv]) => su === du && sv === dv);
  return at < 0 ? NONE : at;
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
  if (from.length === 0 || to.length === 0) return null;
  const onLattice = (point: Point) => ({
    u: alongU(FRAME, point.x, point.y),
    v: alongV(FRAME, point.x, point.y),
  });
  const { minU, minV, width, height } = boxOf([...from, ...to], rules.margin);
  const size = width * height;
  const inBox = (u: number, v: number) => u >= minU && v >= minV && u < minU + width && v < minV + height;
  const cellOf = (u: number, v: number) => (v - minV) * width + (u - minU);
  const middleOf = (cell: number) => diamondMiddle(minU + (cell % width), minV + Math.floor(cell / width));

  // What the ground is under a diamond's middle, and how high.
  const costs = new Float32Array(size).fill(Number.NaN);
  const heights = new Float32Array(size).fill(Number.NaN);
  const costAt = (cell: number) => {
    let cost = costs[cell]!;
    if (Number.isNaN(cost)) {
      const { x, y } = middleOf(cell);
      cost = ground.cost(Math.floor(x), Math.floor(y));
      if (cost >= 1 && ground.barred(Math.floor(x), Math.floor(y))) cost = WATER;
      costs[cell] = cost;
    }
    return cost;
  };
  const heightAt = (cell: number) => {
    let metres = heights[cell]!;
    if (Number.isNaN(metres)) {
      const { x, y } = middleOf(cell);
      metres = ground.height(Math.floor(x), Math.floor(y));
      heights[cell] = metres;
    }
    return metres;
  };
  // The point a diamond is drawn at, on its quarter, as the shape puts it: what every step's line is checked between.
  const pointOf = (cell: number) => onQuarter(middleOf(cell));
  // Whether every world unit the line from one point to another passes over is land a road may cross; and whether a
  // river small enough to bridge was what stopped it.
  let byRiver = false;
  const clearLine = (a: Point, b: Point) =>
    unitsAlong(a.x, a.y, b.x, b.y, (x, y) => {
      const cost = ground.cost(x, y);
      if (cost === BRIDGEABLE) byRiver = true;
      return cost >= 1 && !ground.barred(x, y);
    });
  // Each step's line, worked out once: 1 clear, 2 not, 3 not because of a river a bridge might cross.
  const lines = new Uint8Array(size * NONE);
  const lineClear = (cell: number, step: number, next: number) => {
    const at = cell * NONE + step;
    if (lines[at] === 0) {
      byRiver = false;
      lines[at] = clearLine(pointOf(cell), pointOf(next)) ? 1 : byRiver ? 3 : 2;
    }
    return lines[at]!;
  };

  const goals = new Map<number, Point>();
  for (const end of to) {
    const { u, v } = diamondOf(end);
    const cell = cellOf(u, v);
    if (!inBox(u, v) || goals.has(cell) || costAt(cell) < 1) continue;
    if (clearLine(onQuarter(end), pointOf(cell))) goals.set(cell, end);
  }
  const starts = new Map<number, Point>();
  for (const start of from) {
    const { u, v } = diamondOf(start);
    const cell = cellOf(u, v);
    if (!inBox(u, v) || starts.has(cell) || costAt(cell) < 1) continue;
    if (clearLine(onQuarter(start), pointOf(cell))) starts.set(cell, start);
  }
  if (goals.size === 0 || starts.size === 0) return null;
  const goalPoints = [...goals.values()].map(onLattice);
  // A guess never above what is left: every diamond of the way costs at least what one along a road already there does.
  const guess = (cell: number) => {
    const u = minU + (cell % width) + 0.5;
    const v = minV + Math.floor(cell / width) + 0.5;
    return rules.trunk * Math.min(...goalPoints.map((end) => Math.abs(end.u - u) + Math.abs(end.v - v)));
  };
  // How far a diamond lies from the straight line between the ends: what keeps the plain way near it.
  const a = onLattice([...starts.values()][0]!);
  const b = goalPoints[0]!;
  const long = Math.hypot(b.u - a.u, b.v - a.v) || 1;
  const offLine = (cell: number) =>
    Math.abs(
      ((minU + (cell % width) + 0.5 - a.u) * (b.v - a.v) -
        (minV + Math.floor(cell / width) + 0.5 - a.v) * (b.u - a.u)) /
        long,
    );

  /**
   * The cheapest way, as states: with `turns`, a state is a diamond and the step that came into it, so a turn can be told
   * from going on and costed; without, a diamond alone, and a little cost for straying off the straight line instead.
   * Only the diamonds `within` holds are tried, when it is given.
   */
  const search = (turns: boolean, within: Uint8Array | null) => {
    const per = turns ? STATES : 1;
    const spent = new Float64Array(size * per).fill(Infinity);
    const came = new Int32Array(size * per).fill(-1);
    const done = new Uint8Array(size * per);
    const bridged = new Map<number, Crossing & { step: number }>();
    const heap = new CostHeap();
    const stateOf = (cell: number, step: number) => (turns ? cell * STATES + step : cell);
    for (const cell of starts.keys()) {
      spent[stateOf(cell, NONE)] = 0;
      heap.push(guess(cell), stateOf(cell, NONE));
    }
    let reached = -1;
    while (heap.size > 0) {
      const state = heap.pop();
      if (done[state] === 1) continue;
      done[state] = 1;
      const cell = Math.floor(state / per);
      const coming = turns ? state % per : NONE;
      if (goals.has(cell)) {
        reached = state;
        break;
      }
      const u = minU + (cell % width);
      const v = minV + Math.floor(cell / width);
      const here = costAt(cell);
      const rise = heightAt(cell);
      const onRoad = ground.road(u, v);
      const relax = (
        nextCell: number,
        step: number,
        cost: number,
        crossing: (Crossing & { step: number }) | null,
      ) => {
        if (within !== null && within[nextCell] !== 1) return;
        const next = stateOf(nextCell, step);
        if (done[next] === 1) return;
        const total = spent[state]! + cost + (turns ? 0 : STRAY * offLine(nextCell));
        if (total >= spent[next]!) return;
        spent[next] = total;
        came[next] = state;
        if (crossing === null) bridged.delete(next);
        else bridged.set(next, crossing);
        heap.push(total + guess(nextCell), next);
      };
      // A turn costs, but less along a road already there, which turned there before.
      const turning = (step: number, road: boolean) =>
        coming === NONE || step === NONE || coming === step ? 0 : rules.turn * (road ? rules.trunk : 1);
      let besideRiver = false;
      STEPS.forEach(([du, dv], step) => {
        const nu = u + du;
        const nv = v + dv;
        if (!inBox(nu, nv)) return;
        const next = cellOf(nu, nv);
        const cost = costAt(next);
        if (cost === BRIDGEABLE) besideRiver = true;
        if (cost < 1) return;
        const diagonal = du !== 0 && dv !== 0;
        if (diagonal && (costAt(cellOf(nu, v)) < 1 || costAt(cellOf(u, nv)) < 1)) return;
        const line = lineClear(cell, step, next);
        if (line === 3) besideRiver = true;
        if (line !== 1) return;
        const road = ground.road(nu, nv);
        const along = ((here + cost) / 2) * (diagonal ? rules.diagonal : 1) * (road ? rules.trunk : 1);
        const climb = rules.climb * Math.abs(heightAt(next) - rise);
        relax(next, step, along + climb + turning(step, road && onRoad), null);
      });
      if (!besideRiver) continue;
      for (const found of bridgesFrom(pointOf(cell), ground, rules.longestSpan)) {
        const crossing = { ...found, end: onQuarter(found.end), step: stepOfWay(found.du, found.dv) };
        const { u: lu, v: lv } = diamondOf(crossing.end);
        if (!inBox(lu, lv)) continue;
        const next = cellOf(lu, lv);
        if (costAt(next) < 1 || !clearLine(crossing.end, pointOf(next))) continue;
        const climb = rules.climb * Math.abs(heightAt(next) - rise);
        // A bridge another road has built already is crossed for less, as its road is followed for less; one not
        // along an axis of the lattice for more, as a diagonal step is.
        const built = onRoad && ground.road(lu, lv) ? rules.trunk : 1;
        const across = crossing.step < 4 ? 1 : rules.diagonal / Math.SQRT2;
        const cost = (rules.bridgeAt + rules.bridge * crossing.span) * built * across + climb;
        relax(next, crossing.step, cost + turning(crossing.step, built !== 1), crossing);
      }
    }
    if (reached < 0) return null;
    const states: number[] = [];
    for (let at = reached; at >= 0; at = came[at]!) states.push(at);
    states.reverse();
    return {
      cells: states.map((state) => Math.floor(state / per)),
      crossings: states.map((state) => bridged.get(state)),
    };
  };

  // The plain way first, which is as quick to find as a way can be and fails as quickly when there is none; then the
  // way that keeps to long straight runs, looked for only within `corridor` of it, so its zigzags are no wider.
  const plain = search(false, null);
  if (plain === null) return null;
  const within = new Uint8Array(size);
  const reach = Math.ceil(rules.corridor);
  for (const cell of plain.cells) {
    const u = cell % width;
    const v = Math.floor(cell / width);
    for (let dv = Math.max(0, v - reach); dv <= Math.min(height - 1, v + reach); dv += 1) {
      within.fill(1, dv * width + Math.max(0, u - reach), dv * width + Math.min(width - 1, u + reach) + 1);
    }
  }
  const found = search(true, within) ?? plain;
  const { cells, crossings } = found;

  const points: Point[] = [starts.get(cells[0]!)!];
  const bridges: CourseBridge[] = [];
  const push = (point: Point) => {
    const last = points[points.length - 1]!;
    if (last.x !== point.x || last.y !== point.y) points.push(point);
  };
  cells.forEach((cell, at) => {
    const crossing = crossings[at];
    if (at > 0 && crossing !== undefined) {
      push(middleOf(cells[at - 1]!));
      bridges.push({ at: points.length - 1, axis: crossing.axis, span: crossing.span });
      points.push(crossing.end);
    }
    push(middleOf(cell));
  });
  push(goals.get(cells[cells.length - 1]!)!);
  const units = cells.map((cell) => unitKey(minU + (cell % width), minV + Math.floor(cell / width)));
  const landings = crossings.flatMap((crossing, at) => {
    return at > 0 && crossing !== undefined
      ? [{ at, axis: crossing.axis, span: crossing.span, end: crossing.end }]
      : [];
  });
  return { points, bridges, units, landings };
}

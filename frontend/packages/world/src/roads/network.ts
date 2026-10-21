import type { BridgeAxis } from '../settlementLooks.ts';
import { courseBetween, unitKey } from './course.ts';
import type { Course, CourseGround, CourseRules, Point } from './course.ts';
import type { Join } from './graph.ts';
import { onQuarter, shapeOf } from './shape.ts';
import type { Clear, ShapeRules } from './shape.ts';

/*
 * The roads of a world as one network: every join routed, shortest first, each course the cheaper along the units the
 * ones before it took, so roads that share ground merge into trunks; then every course's units joined into one graph
 * and cut into **chains** - runs between a junction, a place's end or a bridge - each shaped once, so a trunk many
 * roads share is one road and not many laid side by side. A chain's grade is how many roads use it: a track, a road or
 * a trunk. A bridge is a chain of its own, straight along its axis, and the chains that meet it come at it head on, as
 * a road comes into a settlement along its street. Pure, and the same in any order the joins come in. See
 * docs/plans/settlements-and-roads.md and decision record 0115.
 */

/** Where a road may end at a place, and the way out of the place there, so the road comes in along it. */
export interface RoadEnd extends Point {
  readonly out?: Point;
}

export interface NetworkRules extends CourseRules, ShapeRules {
  /** How many roads use a chain for it to be a road rather than a track, and a trunk. */
  readonly grades: readonly [number, number];
  /** How long a straight run a chain makes as it comes into a place or onto a bridge, in world units. */
  readonly approach: number;
}

export const ROAD_GRADES = ['track', 'road', 'trunk'] as const;
export type RoadGrade = (typeof ROAD_GRADES)[number];

/** A chain of the network: its points on the quarter unit, its grade, and the bridge it is, if it is one. */
export interface Chain {
  readonly points: readonly Point[];
  readonly grade: RoadGrade;
  readonly bridge: { readonly axis: BridgeAxis; readonly span: number } | null;
}

/** Every join routed, in the order given, which `placesJoined` gives shortest first; and the joins no way reached. */
export function routeJoins(
  joins: readonly Join[],
  endsOf: (id: string) => readonly RoadEnd[],
  ground: Omit<CourseGround, 'road'>,
  rules: CourseRules,
): { courses: Course[]; unreached: Join[] } {
  const road = new Set<number>();
  const withRoads: CourseGround = { ...ground, road: (x, y) => road.has(unitKey(x, y)) };
  const courses: Course[] = [];
  const unreached: Join[] = [];
  for (const join of joins) {
    const course = courseBetween(endsOf(join.a), endsOf(join.b), withRoads, rules);
    if (course === null) {
      unreached.push(join);
      continue;
    }
    courses.push(course);
    for (const unit of course.units) road.add(unit);
  }
  return { courses, unreached };
}

interface Edge {
  readonly a: number;
  readonly b: number;
  use: number;
  readonly bridge: { axis: BridgeAxis; span: number } | null;
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const centreOf = (unit: number): Point => ({ x: (unit % 65536) + 0.5, y: Math.floor(unit / 65536) + 0.5 });
const ascending = (a: number, b: number) => a - b;

/** The courses as one network of chains, each shaped by `clear` and `rules`, in an order that depends on nothing else. */
export function networkOf(courses: readonly Course[], clear: Clear, rules: NetworkRules): Chain[] {
  const edges = new Map<string, Edge>();
  const near = new Map<number, Set<number>>();
  /** Where a unit's point is when it is not its middle: a place's end, a bridge's far end. */
  const pointAt = new Map<number, Point>();
  /** The way a chain must leave a unit, coming out of a place or off a bridge. */
  const outOf = new Map<number, Point>();

  for (const course of courses) {
    const { units, points } = course;
    const first = points[0] as RoadEnd;
    const last = points[points.length - 1] as RoadEnd;
    pointAt.set(units[0]!, first);
    pointAt.set(units[units.length - 1]!, last);
    if (first.out !== undefined) outOf.set(units[0]!, first.out);
    if (last.out !== undefined) outOf.set(units[units.length - 1]!, last.out);
    const landed = new Map(course.landings.map((landing) => [landing.at, landing]));
    for (let at = 1; at < units.length; at += 1) {
      const a = units[at - 1]!;
      const b = units[at]!;
      if (a === b) continue;
      const landing = landed.get(at);
      if (landing !== undefined) {
        pointAt.set(b, landing.end);
        const start = centreOf(a);
        const ux = (landing.end.x - start.x) / landing.span;
        const uy = (landing.end.y - start.y) / landing.span;
        outOf.set(a, { x: -ux, y: -uy });
        outOf.set(b, { x: ux, y: uy });
      }
      const key = edgeKey(a, b);
      const held = edges.get(key);
      if (held === undefined) {
        edges.set(key, {
          a: Math.min(a, b),
          b: Math.max(a, b),
          use: 1,
          bridge: landing === undefined ? null : { axis: landing.axis, span: landing.span },
        });
      } else {
        held.use += 1;
      }
      for (const [one, other] of [
        [a, b],
        [b, a],
      ] as const) {
        const set = near.get(one) ?? new Set<number>();
        set.add(other);
        near.set(one, set);
      }
    }
  }

  const gradeOf = (use: number): RoadGrade =>
    use >= rules.grades[1] ? 'trunk' : use >= rules.grades[0] ? 'road' : 'track';
  const anchor = (unit: number) => near.get(unit)?.size !== 2 || pointAt.has(unit) || outOf.has(unit);
  const used = new Set<string>();
  const chains: Chain[] = [];

  const walk = (start: number, towards: number) => {
    const units = [start];
    let use = 0;
    let at = start;
    let next = towards;
    for (;;) {
      const key = edgeKey(at, next);
      used.add(key);
      use = Math.max(use, edges.get(key)!.use);
      units.push(next);
      if (anchor(next) || next === start) break;
      const onward = [...near.get(next)!].sort(ascending).find((one) => {
        const edge = edges.get(edgeKey(next, one))!;
        return one !== at && edge.bridge === null && !used.has(edgeKey(next, one));
      });
      if (onward === undefined) break;
      at = next;
      next = onward;
    }
    chains.push({ points: shaped(units), grade: gradeOf(use), bridge: null });
  };

  const shaped = (units: readonly number[]): Point[] => {
    const run: Point[] = [];
    const fixed: boolean[] = [];
    units.forEach((unit, at) => {
      const point = pointAt.get(unit) ?? centreOf(unit);
      const out = outOf.get(unit);
      const ahead =
        out === undefined
          ? null
          : onQuarter({ x: point.x + out.x * rules.approach, y: point.y + out.y * rules.approach });
      const approach = ahead !== null && clear(point, ahead) ? ahead : null;
      if (at === units.length - 1 && approach !== null) {
        run.push(approach);
        fixed.push(true);
      }
      run.push(point);
      fixed.push(true);
      if (at === 0 && approach !== null) {
        run.push(approach);
        fixed.push(true);
      }
      if (at !== 0 && at !== units.length - 1) fixed[fixed.length - 1] = false;
    });
    return shapeOf(run, fixed, clear, rules);
  };

  const units = [...near.keys()].sort(ascending);
  for (const edge of [...edges.values()].sort((one, other) => one.a - other.a || one.b - other.b)) {
    if (edge.bridge === null) continue;
    used.add(edgeKey(edge.a, edge.b));
    const ends = [pointAt.get(edge.a) ?? centreOf(edge.a), pointAt.get(edge.b) ?? centreOf(edge.b)].map(
      onQuarter,
    );
    chains.push({ points: ends, grade: gradeOf(edge.use), bridge: edge.bridge });
  }
  for (const unit of units) {
    if (!anchor(unit)) continue;
    for (const other of [...near.get(unit)!].sort(ascending)) {
      if (!used.has(edgeKey(unit, other))) walk(unit, other);
    }
  }
  // A ring with no junction, end or bridge on it, walked from its lowest unit.
  for (const unit of units) {
    for (const other of [...near.get(unit)!].sort(ascending)) {
      if (!used.has(edgeKey(unit, other))) walk(unit, other);
    }
  }
  return chains;
}

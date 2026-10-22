import { describe, expect, it } from 'vitest';

import { BRIDGE_WAYS, WAY_STEPS } from '../bridgeModel.ts';
import { GROUND_LATTICE, frameOf } from '../lattice.ts';
import { BRIDGEABLE, RIVER, WATER, courseBetween, unitKey, unitOf } from './course.ts';
import type { Course, CourseGround, CourseRules, Point } from './course.ts';
import { unitsAlong } from './line.ts';

const RULES: CourseRules = {
  climb: 0.01,
  bridge: 2,
  bridgeAt: 4,
  longestSpan: 4,
  trunk: 0.5,
  margin: 12,
  turn: 4,
  diagonal: 2.5,
  corridor: 6,
};

/** Ground from a picture of it: `.` land, `~` open water, `r` a river small enough to bridge, `R` one too big. */
function groundOf(
  paint: (x: number, y: number) => string,
  road: ReadonlySet<number> = new Set(),
): CourseGround {
  return {
    cost: (x, y) => {
      const at = paint(x, y);
      return at === '~' ? WATER : at === 'r' ? BRIDGEABLE : at === 'R' ? RIVER : 1;
    },
    height: () => 0,
    barred: () => false,
    road: (x, y) => road.has(unitKey(x, y)),
  };
}

/** Every unit a course passes over between its points that a bridge does not, and which a bridge does. */
function unitsUnder(course: Course): { walked: Set<string>; bridged: Set<string> } {
  const walked = new Set<string>();
  const bridged = new Set<string>();
  const onBridge = new Set(course.bridges.map((bridge) => bridge.at));
  for (let at = 0; at + 1 < course.points.length; at += 1) {
    const a = course.points[at]!;
    const b = course.points[at + 1]!;
    unitsAlong(a.x, a.y, b.x, b.y, (x, y) => {
      (onBridge.has(at) ? bridged : walked).add(`${x},${y}`);
      return true;
    });
  }
  return { walked, bridged };
}

const FRAME = frameOf(GROUND_LATTICE);
/** The eight ways a bridge may run, a unit long in world units. */
const AXES: readonly Point[] = BRIDGE_WAYS.map((way) => {
  const [u, v] = WAY_STEPS[way];
  const length = Math.hypot(u, v);
  return { x: (u * FRAME.cos - v * FRAME.sin) / length, y: (u * FRAME.sin + v * FRAME.cos) / length };
});

const west: Point = { x: 5.5, y: 20.5 };
const east: Point = { x: 45.5, y: 20.5 };

describe("a road's course", () => {
  it('goes round open water, never over it', () => {
    const lake = (x: number, y: number) => (x >= 20 && x < 30 && y >= 5 && y < 35 ? '~' : '.');
    const course = courseBetween([west], [east], groundOf(lake), RULES)!;
    expect(course).not.toBeNull();
    const { walked } = unitsUnder(course);
    for (const unit of walked) {
      const [x, y] = unit.split(',').map(Number);
      expect(lake(x!, y!)).toBe('.');
    }
    expect(course.points[0]).toEqual(west);
    expect(course.points[course.points.length - 1]).toEqual(east);
  });

  it('crosses a river only by a bridge, straight along one of its eight ways', () => {
    const river = (x: number) => (x === 25 || x === 26 ? 'r' : '.');
    const course = courseBetween(
      [west],
      [east],
      groundOf((x) => river(x)),
      RULES,
    )!;
    expect(course.bridges.length).toBe(1);
    const { walked, bridged } = unitsUnder(course);
    for (const unit of walked) expect(river(Number(unit.split(',')[0]))).toBe('.');
    expect([...bridged].some((unit) => river(Number(unit.split(',')[0])) === 'r')).toBe(true);
    for (const bridge of course.bridges) {
      const a = course.points[bridge.at]!;
      const b = course.points[bridge.at + 1]!;
      const long = Math.hypot(b.x - a.x, b.y - a.y);
      // Its far end is put on the quarter of a unit, so it runs within a few degrees of its axis, and as long.
      expect(Math.abs(long - bridge.span)).toBeLessThan(0.4);
      const along = AXES.map((axis) => Math.abs((axis.x * (b.x - a.x) + axis.y * (b.y - a.y)) / long));
      expect(Math.max(...along)).toBeGreaterThan(Math.cos((6 * Math.PI) / 180));
    }
  });

  it('never slips between two units of a river joined only at their corners', () => {
    // A river one unit wide running down a diagonal, too big to bridge: no way across it at all.
    const diagonal = (x: number, y: number) => (x - y === 10 ? 'R' : '.');
    expect(
      courseBetween([{ x: 5.5, y: 20.5 }], [{ x: 45.5, y: 20.5 }], groundOf(diagonal), RULES),
    ).toBeNull();
    // And small enough to bridge, it is crossed only by one.
    const small = (x: number, y: number) => (x - y === 10 ? 'r' : '.');
    const course = courseBetween([{ x: 5.5, y: 20.5 }], [{ x: 45.5, y: 20.5 }], groundOf(small), RULES)!;
    expect(course.bridges.length).toBeGreaterThan(0);
    const { walked } = unitsUnder(course);
    for (const unit of walked) {
      const [x, y] = unit.split(',').map(Number);
      expect(small(x!, y!)).toBe('.');
    }
  });

  it('builds no bridge longer than the longest span', () => {
    const wide = (x: number) => (x >= 22 && x < 30 ? 'r' : '.');
    expect(
      courseBetween(
        [west],
        [east],
        groundOf((x) => wide(x)),
        RULES,
      ),
    ).toBeNull();
  });

  it('follows a road already there, so two roads merge into a trunk', () => {
    const open = () => '.';
    const first = courseBetween([{ x: 5.5, y: 10.5 }], [east], groundOf(open), RULES)!;
    const road = new Set(first.units);
    const alone = courseBetween([{ x: 5.5, y: 30.5 }], [east], groundOf(open), RULES)!;
    const merged = courseBetween([{ x: 5.5, y: 30.5 }], [east], groundOf(open, road), RULES)!;
    const shared = (course: Course) => course.units.filter((unit) => road.has(unit)).length;
    expect(shared(merged)).toBeGreaterThan(shared(alone) + 10);
    expect(shared(merged)).toBeGreaterThan(merged.units.length / 2);
  });

  it("runs along the lattice's axes, not across them, and turns seldom", () => {
    // West to east is across the lattice, which is turned 26 degrees from the world's own grid.
    const course = courseBetween(
      [west],
      [east],
      groundOf(() => '.'),
      RULES,
    )!;
    const steps = course.units.slice(1).map((unit, at) => {
      const here = unitOf(course.units[at]!);
      const there = unitOf(unit);
      return [there.x - here.x, there.y - here.y] as const;
    });
    expect(steps.filter(([du, dv]) => du !== 0 && dv !== 0)).toEqual([]);
    const turns = steps.filter(
      (step, at) => at > 0 && (step[0] !== steps[at - 1]![0] || step[1] !== steps[at - 1]![1]),
    );
    expect(turns.length).toBeLessThanOrEqual(2);
  });

  it('is the same course however often it is walked', () => {
    const lake = (x: number, y: number) =>
      x >= 20 && x < 30 && y >= 5 && y < 35 ? '~' : x === 38 ? 'r' : '.';
    const once = courseBetween([west], [east], groundOf(lake), RULES);
    expect(courseBetween([west], [east], groundOf(lake), RULES)).toEqual(once);
  });
});

describe('the units along a line', () => {
  it('takes the same units walked either way, an end on a corner too', () => {
    const walk = (ax: number, ay: number, bx: number, by: number) => {
      const seen: string[] = [];
      unitsAlong(ax, ay, bx, by, (x, y) => {
        seen.push(`${x},${y}`);
        return true;
      });
      return seen.sort();
    };
    for (const [ax, ay, bx, by] of [
      [12.5, 9.5, 13, 11],
      [3, 4, 5.25, 7],
      [7.75, 2.25, 6, 1],
      [10, 10, 12, 12],
    ] as const) {
      expect(walk(ax, ay, bx, by)).toEqual(walk(bx, by, ax, ay));
    }
    // Ending on a corner, it takes the unit its end is in, and not the two it only touches there.
    expect(walk(12.5, 9.5, 13, 9)).toEqual(['12,9', '13,9']);
  });

  it('takes both units beside a corner it passes exactly through', () => {
    const seen: string[] = [];
    unitsAlong(0.5, 0.5, 2.5, 2.5, (x, y) => {
      seen.push(`${x},${y}`);
      return true;
    });
    expect(seen).toEqual(['0,0', '1,0', '0,1', '1,1', '2,1', '1,2', '2,2']);
  });
});

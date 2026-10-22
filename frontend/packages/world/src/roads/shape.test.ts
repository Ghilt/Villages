import { describe, expect, it } from 'vitest';

import { GROUND_LATTICE, frameOf } from '../lattice.ts';
import { WATER, courseBetween, diamondMiddle } from './course.ts';
import type { CourseGround, Point } from './course.ts';
import { clearOver, onQuarter, shapeOf } from './shape.ts';

/** A wall of water one unit thick from the north edge down to y 25, which a road from west to east must go round. */
const wall: CourseGround = {
  cost: (x, y) => (x === 40 && y < 25 ? WATER : 1),
  height: () => 0,
  barred: () => false,
  road: () => false,
};
const clear = clearOver(wall.cost, wall.barred);
const RULES = {
  climb: 0,
  bridge: 2,
  bridgeAt: 4,
  longestSpan: 4,
  trunk: 0.5,
  margin: 12,
  turn: 4,
  diagonal: 2.5,
  corridor: 6,
};
const FRAME = frameOf(GROUND_LATTICE);
const AXES: readonly Point[] = [
  { x: FRAME.cos, y: FRAME.sin },
  { x: -FRAME.sin, y: FRAME.cos },
];

/** A run of diamonds' middles ten along the lattice's first axis and then ten along its second: one turn. */
const turn: Point[] = [
  ...Array.from({ length: 11 }, (_, at) => diamondMiddle(100 + at, 40)),
  ...Array.from({ length: 10 }, (_, at) => diamondMiddle(110, 41 + at)),
];
const corner = diamondMiddle(110, 40);
/** A shape with every turn the same and no strays, to see the grid by. */
const STILL = { turning: 2.5, widerTurning: 2.5, widerShare: 0, stray: 0, strayEvery: 6 };
const nearest = (shape: readonly Point[], to: Point) =>
  Math.min(...shape.map((point) => Math.hypot(point.x - to.x, point.y - to.y)));

describe("a road's shape", () => {
  const course = courseBetween([{ x: 30.5, y: 10.5 }], [{ x: 50.5, y: 10.5 }], wall, RULES)!;
  const shape = shapeOf(
    course.points,
    course.points.map(() => false),
    clear,
    STILL,
  );

  it('goes round the point of the wall, never over it', () => {
    expect(course.points.some((point) => point.y > 24)).toBe(true);
    for (let at = 0; at + 1 < shape.length; at += 1) expect(clear(shape[at]!, shape[at + 1]!)).toBe(true);
  });

  it("runs straight along the lattice's axes between its turns, and keeps its ends", () => {
    expect(shape.length).toBeLessThan(course.points.length);
    for (let at = 0; at + 1 < shape.length; at += 1) {
      const a = shape[at]!;
      const b = shape[at + 1]!;
      const long = Math.hypot(b.x - a.x, b.y - a.y);
      if (long < 3) continue;
      const along = AXES.map((axis) => Math.abs((axis.x * (b.x - a.x) + axis.y * (b.y - a.y)) / long));
      expect(Math.max(...along)).toBeGreaterThan(Math.cos((5 * Math.PI) / 180));
    }
    expect(shape[0]).toEqual({ x: 30.5, y: 10.5 });
    expect(shape[shape.length - 1]).toEqual({ x: 50.5, y: 10.5 });
  });

  it('rounds a turn to the turning radius, going across the grid only as it turns', () => {
    const rounded = shapeOf(
      turn,
      turn.map(() => false),
      () => true,
      STILL,
    );
    // The corner itself is cut; the rounding starts about the radius back along the first run.
    expect(nearest(rounded, corner)).toBeGreaterThan(0.5);
    expect(rounded.length).toBeGreaterThan(4);
    expect(Math.abs(Math.hypot(rounded[1]!.x - corner.x, rounded[1]!.y - corner.y) - 2.5)).toBeLessThan(0.4);
  });

  it('leaves a turn sharp where rounding it would cross water', () => {
    const inside = {
      x: corner.x + 0.88 * (-AXES[0]!.x + AXES[1]!.x),
      y: corner.y + 0.88 * (-AXES[0]!.y + AXES[1]!.y),
    };
    const wet = clearOver(
      (x, y) => (x === Math.floor(inside.x) && y === Math.floor(inside.y) ? WATER : 1),
      () => false,
    );
    const sharp = shapeOf(
      turn,
      turn.map(() => false),
      wet,
      STILL,
    );
    expect(nearest(sharp, corner)).toBeLessThan(0.2);
  });

  /** A run a hundred and fifty diamonds long along the lattice's first axis, and how far a point is off it and along it. */
  const long = Array.from({ length: 151 }, (_, at) => diamondMiddle(300 + at, 70));
  const [first, last] = [long[0]!, long[150]!];
  const off = (point: Point) =>
    ((point.x - first.x) * (last.y - first.y) - (point.y - first.y) * (last.x - first.x)) / 150;
  const along = (point: Point) =>
    ((point.x - first.x) * (last.x - first.x) + (point.y - first.y) * (last.y - first.y)) / 150;
  const strayed = shapeOf(
    long,
    long.map(() => false),
    () => true,
    { ...STILL, stray: 1.2 },
  );

  it('strays from a long straight run here and there, never further than its most, back onto it at its ends', () => {
    expect(Math.max(...strayed.map((point) => Math.abs(off(point))))).toBeLessThanOrEqual(1.2 + 0.18);
    expect(strayed.filter((point) => Math.abs(off(point)) > 0.5).length).toBeGreaterThan(3);
    expect([strayed[0], strayed[strayed.length - 1]]).toEqual([onQuarter(first), onQuarter(last)]);
  });

  it('shifts across and keeps on beside its line a while, not only back and forth', () => {
    // A line of the shape four units long or more, well off the run and running along it: a shift kept to.
    const kept = strayed.slice(1).some((point, at) => {
      const before = strayed[at]!;
      return (
        along(point) - along(before) >= 4 &&
        Math.abs(off(point)) > 0.3 &&
        Math.abs(off(before)) > 0.3 &&
        Math.abs(off(point) - off(before)) < 0.3
      );
    });
    expect(kept).toBe(true);
  });

  it('stays straight where a stray would not be clear', () => {
    const narrow = (a: Point, b: Point) => Math.abs(off(a)) < 0.2 && Math.abs(off(b)) < 0.2;
    const shape = shapeOf(
      long,
      long.map(() => false),
      narrow,
      { ...STILL, stray: 1.2 },
    );
    expect(shape).toEqual([onQuarter(first), onQuarter(last)]);
  });

  it('rounds most turns to one radius and some to a wider', () => {
    // A staircase of twenty turns, each run twelve diamonds long, along the lattice's two axes in turn.
    const stairs: Point[] = [diamondMiddle(0, 0)];
    const corners: Point[] = [];
    for (let leg = 0; leg < 21; leg += 1) {
      for (let step = 1; step <= 12; step += 1) {
        const u = Math.ceil(leg / 2) * 12 + (leg % 2 === 0 ? step : 0);
        const v = Math.floor(leg / 2) * 12 + (leg % 2 === 1 ? step : 0);
        stairs.push(diamondMiddle(u, v));
      }
      if (leg < 20) corners.push(stairs[stairs.length - 1]!);
    }
    const shape = shapeOf(
      stairs,
      stairs.map(() => false),
      () => true,
      { ...STILL, widerTurning: 5, widerShare: 0.3 },
    );
    const cut = corners.map((corner) => nearest(shape, corner));
    // A turn cut back by a radius r passes about a third of r from its corner.
    expect(cut.filter((one) => Math.abs(one - 0.88) < 0.3).length).toBeGreaterThan(8);
    expect(cut.some((one) => Math.abs(one - 1.77) < 0.3)).toBe(true);
  });

  it('keeps a point it is told to keep', () => {
    const middle = Math.floor(course.points.length / 2);
    const kept = shapeOf(
      course.points,
      course.points.map((_, at) => at === middle),
      clear,
      STILL,
    );
    const at = course.points[middle]!;
    expect(kept).toContainEqual(onQuarter(at));
  });
});

import { describe, expect, it } from 'vitest';

import { WATER, courseBetween } from './course.ts';
import type { CourseGround } from './course.ts';
import { clearOver, shapeOf } from './shape.ts';

/** A wall of water one unit thick from the north edge down to y 25, which a road from west to east must go round. */
const wall: CourseGround = {
  cost: (x, y) => (x === 40 && y < 25 ? WATER : 1),
  height: () => 0,
  barred: () => false,
  road: () => false,
};
const clear = clearOver(wall.cost, wall.barred);
const RULES = { climb: 0, bridge: 2, bridgeAt: 4, longestSpan: 4, trunk: 0.5, margin: 12 };

describe("a road's shape", () => {
  const course = courseBetween([{ x: 30.5, y: 10.5 }], [{ x: 50.5, y: 10.5 }], wall, RULES)!;
  const shape = shapeOf(
    course.points,
    course.points.map(() => false),
    clear,
    { straightest: 8, smoothing: 3 },
  );

  it('goes round the point of the wall, never over it', () => {
    expect(course.points.some((point) => point.y > 24)).toBe(true);
    for (let at = 0; at + 1 < shape.length; at += 1) expect(clear(shape[at]!, shape[at + 1]!)).toBe(true);
  });

  it('is straightened from its course, and keeps its ends', () => {
    const straight = shapeOf(
      course.points,
      course.points.map(() => false),
      clear,
      { straightest: 8, smoothing: 0 },
    );
    expect(straight.length).toBeLessThan(course.points.length / 2);
    for (let at = 0; at + 1 < straight.length; at += 1)
      expect(clear(straight[at]!, straight[at + 1]!)).toBe(true);
    expect(shape[0]).toEqual({ x: 30.5, y: 10.5 });
    expect(shape[shape.length - 1]).toEqual({ x: 50.5, y: 10.5 });
  });

  it('keeps a point it is told to keep', () => {
    const middle = Math.floor(course.points.length / 2);
    const kept = shapeOf(
      course.points,
      course.points.map((_, at) => at === middle),
      clear,
      { straightest: 8, smoothing: 3 },
    );
    const at = course.points[middle]!;
    expect(kept).toContainEqual({ x: Math.round(at.x * 4) / 4, y: Math.round(at.y * 4) / 4 });
  });
});

import { GROUND_LATTICE, alongU, alongV, frameOf, worldXOf, worldYOf } from '../lattice.ts';
import type { CourseRules, Point } from './course.ts';

/*
 * The ground lattice's diamonds as a road's course walks them: where a diamond's middle is in the world, which diamond a
 * point lies in, the box of them a course is looked for in, and how far over the world that box reaches. See
 * `course.ts` and decision record 0115.
 */

const FRAME = frameOf(GROUND_LATTICE);

/** The middle of the lattice's diamond `u`, `v`, in world units. */
export function diamondMiddle(u: number, v: number): Point {
  return { x: worldXOf(FRAME, u + 0.5, v + 0.5), y: worldYOf(FRAME, u + 0.5, v + 0.5) };
}

/** The lattice's diamond a point of the world lies in. */
export function diamondOf(point: Point): { u: number; v: number } {
  return { u: Math.floor(alongU(FRAME, point.x, point.y)), v: Math.floor(alongV(FRAME, point.x, point.y)) };
}

/** The box of the lattice's diamonds a course between some ends is looked for in: past them by `margin` and a share. */
export function boxOf(ends: readonly Point[], margin: number) {
  const us = ends.map((point) => alongU(FRAME, point.x, point.y));
  const vs = ends.map((point) => alongV(FRAME, point.x, point.y));
  const stray =
    margin + 0.25 * Math.hypot(Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs));
  const minU = Math.floor(Math.min(...us) - stray);
  const minV = Math.floor(Math.min(...vs) - stray);
  return {
    minU,
    minV,
    width: Math.ceil(Math.max(...us) + stray) - minU + 1,
    height: Math.ceil(Math.max(...vs) + stray) - minV + 1,
  };
}

/**
 * How far over the world, in world units, a course between some ends may look at the ground: its box of diamonds, and a
 * bridge's reach past it. What the tiles round a road are read for before it is routed.
 */
export function courseReach(
  ends: readonly Point[],
  rules: Pick<CourseRules, 'margin' | 'longestSpan'>,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const { minU, minV, width, height } = boxOf(ends, rules.margin);
  const corners = [
    [minU, minV],
    [minU + width, minV],
    [minU, minV + height],
    [minU + width, minV + height],
  ].map(([u, v]) => ({ x: worldXOf(FRAME, u!, v!), y: worldYOf(FRAME, u!, v!) }));
  const pad = rules.longestSpan + 4;
  return {
    minX: Math.min(...corners.map((one) => one.x)) - pad,
    minY: Math.min(...corners.map((one) => one.y)) - pad,
    maxX: Math.max(...corners.map((one) => one.x)) + pad,
    maxY: Math.max(...corners.map((one) => one.y)) + pad,
  };
}

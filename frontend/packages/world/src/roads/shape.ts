import type { Point } from './course.ts';
import { unitsAlong } from './line.ts';

/*
 * A road's shape: the units its course stepped on, straightened where a straight line is as good, and its corners
 * cut, a few times over, so it bends as a road bends rather than in steps of eight. Every straight line of it is
 * checked to pass over nothing but land a road may cross, and a cut that would take it over water or a river, or
 * across a settlement's square or a ruin's piece, is not made. Its ends, its bridges' ends and their approaches are
 * fixed and never move. Every point lies on the quarter of a world unit, so the records it is cut into meet end to
 * end exactly. See docs/plans/settlements-and-roads.md.
 */

export interface ShapeRules {
  /** The longest straight line a run of steps is replaced by, in world units: longer, and it would cut over hills. */
  readonly straightest: number;
  /** How many times its corners are cut. */
  readonly smoothing: number;
}

/** Whether the straight line between two points passes over nothing a road may not. */
export type Clear = (a: Point, b: Point) => boolean;

/** A line between two points is clear when every unit under it is land, `cost` one or more, and nothing bars it. */
export function clearOver(
  cost: (x: number, y: number) => number,
  barred: (x: number, y: number) => boolean,
): Clear {
  return (a, b) => unitsAlong(a.x, a.y, b.x, b.y, (x, y) => cost(x, y) >= 1 && !barred(x, y));
}

/** A point put on the nearest quarter of a world unit. */
export function onQuarter(point: Point): Point {
  return { x: Math.round(point.x * 4) / 4, y: Math.round(point.y * 4) / 4 };
}

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** The points straightened between the fixed ones: from each, the furthest it can see within `straightest`. */
function straightened(
  points: readonly Point[],
  fixed: readonly boolean[],
  clear: Clear,
  straightest: number,
) {
  const out: Point[] = [points[0]!];
  const kept: boolean[] = [true];
  let at = 0;
  while (at < points.length - 1) {
    let next = at + 1;
    for (let to = at + 2; to < points.length; to += 1) {
      const from = points[at]!;
      const there = points[to]!;
      if (Math.hypot(there.x - from.x, there.y - from.y) > straightest) break;
      if (fixed[to - 1] === true) break;
      if (clear(from, there)) next = to;
    }
    out.push(points[next]!);
    kept.push(fixed[next] === true);
    at = next;
  }
  return { points: out, fixed: kept };
}

/** One cut of every corner that is not fixed, or the corners that keep it off what it may not cross left as they were. */
function cut(
  points: readonly Point[],
  fixed: boolean[],
  clear: Clear,
): { points: Point[]; fixed: boolean[] } {
  const held = [...fixed];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const out: Point[] = [points[0]!];
    const from: number[] = [0];
    for (let at = 1; at < points.length - 1; at += 1) {
      const here = points[at]!;
      if (held[at] === true) {
        out.push(here);
        from.push(at);
        continue;
      }
      const before = points[at - 1]!;
      const after = points[at + 1]!;
      const one = onQuarter({ x: here.x + (before.x - here.x) / 4, y: here.y + (before.y - here.y) / 4 });
      const two = onQuarter({ x: here.x + (after.x - here.x) / 4, y: here.y + (after.y - here.y) / 4 });
      for (const point of [one, two]) {
        if (!same(point, out[out.length - 1]!)) {
          out.push(point);
          from.push(at);
        }
      }
    }
    out.push(points[points.length - 1]!);
    from.push(points.length - 1);
    // Every line checked as it now is; a corner on either side of one that is not clear is left uncut.
    let fine = true;
    for (let at = 0; at + 1 < out.length; at += 1) {
      if (clear(out[at]!, out[at + 1]!)) continue;
      const one = from[at]!;
      const other = from[at + 1]!;
      // Between two corners left uncut it is a line of the run itself, which stays as it was.
      if (held[one] === true && held[other] === true) continue;
      fine = false;
      held[one] = true;
      held[other] = true;
    }
    if (fine) {
      const kept = out.map(
        (_, at) => from[at] === 0 || from[at] === points.length - 1 || fixed[from[at]!] === true,
      );
      return { points: out, fixed: kept.map((one, at) => one && (at === 0 || from[at] !== from[at - 1])) };
    }
  }
  return { points: [...points], fixed: [...fixed] };
}

/**
 * The shape of a run of points, its first and last fixed and any others `fixed` says: straightened, its corners cut
 * `rules.smoothing` times, every point on the quarter of a unit, every line clear by `clear`. A line of the run itself
 * that is not clear stays as it was.
 */
export function shapeOf(
  run: readonly Point[],
  fixed: readonly boolean[],
  clear: Clear,
  rules: ShapeRules,
): Point[] {
  const points: Point[] = [];
  const kept: boolean[] = [];
  run.forEach((point, at) => {
    const quarter = onQuarter(point);
    const pin = at === 0 || at === run.length - 1 || fixed[at] === true;
    if (points.length > 0 && same(points[points.length - 1]!, quarter)) {
      kept[kept.length - 1] = kept[kept.length - 1]! || pin;
      return;
    }
    points.push(quarter);
    kept.push(pin);
  });
  if (points.length < 3) return points;
  let shape = straightened(points, kept, clear, rules.straightest);
  for (let pass = 0; pass < rules.smoothing; pass += 1) shape = cut(shape.points, shape.fixed, clear);
  return shape.points;
}

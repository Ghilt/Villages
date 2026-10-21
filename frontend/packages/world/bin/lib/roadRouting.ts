import { courseBetween } from '../../src/roads/course.ts';
import type { Course, CourseGround, CourseRules, Point } from '../../src/roads/course.ts';

/*
 * One road routed between two places for `world:roads`: the tiles round the two held first, the cheapest way found,
 * and once more four times as far when a fjord or a lake makes the way stray further than a road's box allows. The
 * units a road takes are remembered, so the next road is cheaper along it and roads merge into trunks.
 */

interface Tiles {
  prepare(minX: number, minY: number, maxX: number, maxY: number): Promise<void>;
}

/** A place a road is routed between, by its ends. */
interface Ends {
  readonly ends: readonly Point[];
}

export function roadRouter(
  tiles: Tiles,
  ground: CourseGround,
  rules: CourseRules,
  road: Set<number>,
): (a: Ends, b: Ends) => Promise<Course | null> {
  return async (a, b) => {
    const all = [...a.ends, ...b.ends];
    const xs = all.map((one) => one.x);
    const ys = all.map((one) => one.y);
    const pad =
      rules.margin +
      0.25 * Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) +
      rules.longestSpan +
      4;
    await tiles.prepare(
      Math.min(...xs) - pad,
      Math.min(...ys) - pad,
      Math.max(...xs) + pad,
      Math.max(...ys) + pad,
    );
    let course = courseBetween(a.ends, b.ends, ground, rules);
    if (course === null) {
      const wider = pad + 3 * rules.margin;
      await tiles.prepare(
        Math.min(...xs) - wider,
        Math.min(...ys) - wider,
        Math.max(...xs) + wider,
        Math.max(...ys) + wider,
      );
      course = courseBetween(a.ends, b.ends, ground, { ...rules, margin: rules.margin * 4 });
    }
    if (course !== null) for (const unit of course.units) road.add(unit);
    return course;
  };
}

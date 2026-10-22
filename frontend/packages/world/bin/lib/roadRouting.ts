import { courseBetween, courseReach } from '../../src/roads/course.ts';
import type { Course, CourseGround, CourseRules, Point } from '../../src/roads/course.ts';

/*
 * One road routed between two places for `world:roads`: the tiles a course between the two may look at held first,
 * the cheapest way found, and once more four times as far when a fjord or a lake makes the way stray further than a
 * road's box allows. The diamonds a road takes are remembered, so the next road is cheaper along it and roads merge
 * into trunks.
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
  const routed = async (a: Ends, b: Ends, how: CourseRules) => {
    const { minX, minY, maxX, maxY } = courseReach([...a.ends, ...b.ends], how);
    await tiles.prepare(minX, minY, maxX, maxY);
    return courseBetween(a.ends, b.ends, ground, how);
  };
  return async (a, b) => {
    const course =
      (await routed(a, b, rules)) ?? (await routed(a, b, { ...rules, margin: rules.margin * 4 }));
    if (course !== null) for (const unit of course.units) road.add(unit);
    return course;
  };
}

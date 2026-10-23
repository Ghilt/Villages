import { describe, expect, it } from 'vitest';

import { project } from './camera';
import type { Point, RoomCamera } from './camera';
import { TABLE_HIGH, floorOf, metreOf, tableBlocks, tableOf } from './model';

const DESK = { left: -300, top: -150, width: 1800, height: 1800 / 1.45 };

/** The camera spent: drawn back, turned 26 and tipped 45. */
const SPENT: RoomCamera = { scale: 0.2, about: { x: 450, y: 300 }, turn: 26, tip: 45 };

/** Whether a point is inside a four-cornered shape whose corners go round it in order. */
function inside(corners: Point[], point: Point): boolean {
  const signs = corners.map((from, index) => {
    const to = corners[(index + 1) % corners.length] ?? from;
    return Math.sign((to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x));
  });
  return signs.every((sign) => sign === signs[0]);
}

describe('the floor', () => {
  it("lies a table's height below the map", () => {
    for (const corner of floorOf(DESK)) {
      expect(corner.up).toBeCloseTo(-TABLE_HIGH * metreOf(DESK));
    }
  });
});

describe('the table', () => {
  const blocks = tableBlocks(DESK);
  const legs = blocks.slice(0, 4);
  const top = tableOf(DESK);

  it('stands on four legs inside its top, from the floor up to under the top', () => {
    expect(legs).toHaveLength(4);
    const box = { left: top[0]?.x ?? 0, top: top[0]?.y ?? 0, right: top[2]?.x ?? 0, bottom: top[2]?.y ?? 0 };
    for (const leg of legs) {
      expect(leg.west).toBeGreaterThan(box.left);
      expect(leg.east).toBeLessThan(box.right);
      expect(leg.north).toBeGreaterThan(box.top);
      expect(leg.south).toBeLessThan(box.bottom);
      expect(leg.low).toBeCloseTo(-TABLE_HIGH * metreOf(DESK));
      expect(leg.high).toBeLessThan(0);
    }
  });

  it('leaves its top undrawn, because the top is the desk the page already draws', () => {
    expect(blocks.every((block) => block.top === null)).toBe(true);
  });

  it('hides its back legs under its top as the camera sees it, and shows its front legs below it', () => {
    const drawnTop = top.map((corner) => project(SPENT, corner));
    const foot = (leg: (typeof legs)[number]) => project(SPENT, { x: leg.west, y: leg.north }, leg.low);
    const [northWest, , southEast] = legs;
    if (northWest === undefined || southEast === undefined) {
      throw new Error('the table has its four legs');
    }
    expect(inside(drawnTop, foot(northWest))).toBe(true);
    expect(inside(drawnTop, project(SPENT, { x: southEast.east, y: southEast.south }, southEast.low))).toBe(
      false,
    );
  });
});

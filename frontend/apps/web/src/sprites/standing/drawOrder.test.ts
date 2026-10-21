import { describe, expect, it } from 'vitest';

import { drawOrder } from './drawOrder';
import type { Building, Tree } from './drawOrder';

/** A footprint whose left side is shorter than its right, so its line runs down the screen to the right. */
function slanted(dx = 0, dy = 0): Building {
  const at = (x: number, y: number) => ({ x: x + dx, y: y + dy });
  return {
    corners: [at(0, 3), at(4, 7), at(10, 6), at(6, 2)],
    foot: at(5, 7),
    anchor: 0.5,
    tall: 8,
    wide: 10,
  };
}

/** A tree a unit wide and two tall standing at a point. */
function tree(x: number, y: number): Tree {
  return { x, y, left: x - 0.5, right: x + 0.5, top: y - 2 };
}

describe('the order the trees and the buildings among them are drawn in', () => {
  it('draws a tree in front of a building when its foot is below the line from corner to corner, whatever its height', () => {
    // In front of the left wall, and behind the right one though further down the screen: no one height says both.
    const left = tree(0.5, 4);
    const right = tree(9.5, 5.2);

    const { order, slices } = drawOrder([slanted()], [left, right]);

    expect(order).toEqual([0]);
    expect([...slices]).toEqual([1, 0]);
  });

  it("measures a tree beyond the building's ends against the corner on that side", () => {
    const frontOfTheCorner = tree(-2, 3.5);
    const behindIt = tree(-2, 2.5);
    const beyondTheRight = tree(12, 5.5);

    const { slices } = drawOrder([slanted()], [behindIt, frontOfTheCorner, beyondTheRight]);

    expect([...slices]).toEqual([0, 1, 0]);
  });

  it('draws the farther of two buildings first, and a tree between them between them', () => {
    const far = slanted(2, -6);
    const near = slanted();
    const between = tree(7, 2.5);

    const { order, slices } = drawOrder([near, far], [between]);

    expect(order).toEqual([1, 0]);
    expect([...slices]).toEqual([1]);
  });

  it('keeps a tree before a building it stands behind, though it is below the line of one drawn after it', () => {
    // A line steep enough that a building elsewhere, drawn after it by their middles, is above the tree.
    const steep: Building = {
      corners: [
        { x: 0, y: 10 },
        { x: 6, y: 31 },
        { x: 10, y: 30 },
        { x: 4, y: 9 },
      ],
      foot: { x: 5, y: 31 },
      anchor: 0.5,
      tall: 20,
      wide: 10,
    };
    const elsewhere = slanted(100, 19);
    const behindTheSteep = tree(9, 27);

    const { order, slices } = drawOrder([elsewhere, steep], [behindTheSteep]);

    expect(order).toEqual([1, 0]);
    expect([...slices]).toEqual([0]);
  });

  it('draws every tree in one slice when nothing stands among them', () => {
    const { order, slices } = drawOrder([], [tree(0, 0), tree(1, 1)]);

    expect(order).toEqual([]);
    expect([...slices]).toEqual([0, 0]);
  });
});

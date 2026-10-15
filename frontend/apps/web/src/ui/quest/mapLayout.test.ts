import { describe, expect, it } from 'vitest';

import { STUB, TITLE_ROOM, footOf, headOf, heightOf, pathOf, placeOf } from './mapLayout';

const spacing = { width: 300, rowHeight: 120, nodeSize: 40 };

describe("a quest map's places", () => {
  it('spread a row evenly across the width, and stand each row a row lower', () => {
    expect(placeOf({ row: 0, column: 0, columns: 1 }, spacing).x).toBe(150);
    expect(placeOf({ row: 1, column: 0, columns: 2 }, spacing).x).toBe(75);
    expect(placeOf({ row: 1, column: 1, columns: 2 }, spacing).x).toBe(225);
    const first = placeOf({ row: 0, column: 0, columns: 1 }, spacing).y;
    expect(placeOf({ row: 3, column: 0, columns: 1 }, spacing).y - first).toBe(360);
  });

  it('keep a column past the row in the row, and leave room for every row, its title and a stub at each end', () => {
    expect(placeOf({ row: 0, column: 5, columns: 2 }, spacing).x).toBe(225);
    const deepest = placeOf({ row: 3, column: 0, columns: 1 }, spacing);
    expect(heightOf(4, spacing)).toBeGreaterThan(footOf(deepest, spacing, true).y + STUB);
  });

  it('send edges out from under a title, so none crosses it, and in at the head', () => {
    const middle = { x: 150, y: 50 };
    expect(footOf(middle, spacing, false).y).toBe(70);
    expect(footOf(middle, spacing, true).y).toBe(70 + TITLE_ROOM);
    expect(headOf(middle, spacing).y).toBe(30);
  });
});

describe("a quest map's edges", () => {
  const leaving = { x: 150, y: 70 };
  const reaching = { x: 75, y: 130 };

  it('run from where they leave one node to where they reach the next', () => {
    expect(pathOf(leaving, reaching)).toBe('M150 70 C150 100 75 100 75 130');
  });

  it('are a stub down out of a node, or into one, where the other end is not drawn, and nothing with neither', () => {
    expect(pathOf(leaving, undefined)).toBe(`M150 70 L150 ${70 + STUB}`);
    expect(pathOf(undefined, reaching)).toBe(`M75 ${130 - STUB} L75 130`);
    expect(pathOf(undefined, undefined)).toBeNull();
  });
});

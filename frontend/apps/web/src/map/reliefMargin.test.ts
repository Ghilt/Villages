import { describe, expect, it } from 'vitest';

import { widen } from './reliefMargin';

const SIDE = 4;
const MARGIN = 2;
const WIDE = SIDE + 2 * MARGIN;

/** A tile whose every height is the same number. */
const level = (height: number) => new Int16Array(SIDE * SIDE).fill(height);

/** A tile rising eastward, ten metres a texel from `from` at its west edge. */
const rampEast = (from: number) => Int16Array.from({ length: SIDE * SIDE }, (_, i) => from + 10 * (i % SIDE));

const at = (wide: Int16Array, row: number, column: number) => wide[row * WIDE + column];

describe('a height tile widened with its neighbours’ margin', () => {
  it('carries its own heights in the middle and each neighbour’s on its side', () => {
    const nine = Array.from({ length: 9 }, (_, i) => level(100 * i));
    const wide = widen(nine, SIDE, MARGIN);
    expect(at(wide, MARGIN, MARGIN)).toBe(400);
    expect(at(wide, 0, 0)).toBe(0);
    expect(at(wide, 0, MARGIN)).toBe(100);
    expect(at(wide, 0, WIDE - 1)).toBe(200);
    expect(at(wide, MARGIN, 0)).toBe(300);
    expect(at(wide, MARGIN, WIDE - 1)).toBe(500);
    expect(at(wide, WIDE - 1, 0)).toBe(600);
    expect(at(wide, WIDE - 1, MARGIN)).toBe(700);
    expect(at(wide, WIDE - 1, WIDE - 1)).toBe(800);
  });

  it('carries its own slope on past an edge whose neighbour is not here yet', () => {
    const nine: (Int16Array | null)[] = Array.from({ length: 9 }, () => null);
    nine[4] = rampEast(1000);
    const wide = widen(nine, SIDE, MARGIN);
    // West of the edge the ramp goes on down, east of it on up, and the same in every row, corners included.
    for (let row = 0; row < WIDE; row += 1) {
      expect(Array.from({ length: WIDE }, (_, column) => at(wide, row, column))).toEqual([
        980, 990, 1000, 1010, 1020, 1030, 1040, 1050,
      ]);
    }
  });

  it('carries a neighbour’s margin on into a corner whose own neighbour is missing', () => {
    const nine: (Int16Array | null)[] = Array.from({ length: 9 }, () => null);
    nine[4] = level(500);
    nine[1] = rampEast(2000);
    const wide = widen(nine, SIDE, MARGIN);
    expect(at(wide, 0, MARGIN)).toBe(2000);
    expect(at(wide, 0, MARGIN - 1)).toBe(1990);
    expect(at(wide, 0, WIDE - 1)).toBe(2050);
    expect(at(wide, MARGIN, 0)).toBe(500);
  });

  it('never wraps a height past what a texture of whole metres holds', () => {
    const nine: (Int16Array | null)[] = Array.from({ length: 9 }, () => null);
    nine[4] = Int16Array.from({ length: SIDE * SIDE }, (_, i) => (i % SIDE === 0 ? 30000 : 0));
    const wide = widen(nine, SIDE, MARGIN);
    expect(at(wide, MARGIN, 0)).toBe(32767);
  });
});

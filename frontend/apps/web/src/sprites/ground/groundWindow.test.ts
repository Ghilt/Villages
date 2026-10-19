import { describe, expect, it } from 'vitest';

import { MARGIN, ROW_ALIGNMENT, WIDEST, covers, fillWindow, windowFor } from './groundWindow';
import { WORKED } from './worked';
import { diamondKey } from './workedGround';

describe("the worked ground's window", () => {
  const bounds = { fromU: 100.4, toU: 180.2, fromV: -40.7, toV: 10.9 };

  it('covers the view and a margin round it, so a camera moving inside it keeps it', () => {
    const window = windowFor(bounds)!;
    expect(covers(window, bounds)).toBe(true);
    expect(window.u).toBe(100 - MARGIN);
    expect(window.v).toBe(-41 - MARGIN);
    const moved = { fromU: 100.4 + MARGIN - 1, toU: 180.2 + MARGIN - 1, fromV: -40.7, toV: 10.9 };
    expect(covers(window, moved)).toBe(true);
    expect(covers(window, { ...moved, toU: window.u + window.width + 0.5 })).toBe(false);
  });

  it('is a whole number of four diamonds across, whatever the view, so WebGL takes its rows', () => {
    for (let wide = 0; wide < 40; wide += 1) {
      const window = windowFor({ fromU: 10.3, toU: 10.3 + wide + 0.37 * (wide % 3), fromV: 0, toV: 5 })!;
      expect(window.width % ROW_ALIGNMENT).toBe(0);
      expect(covers(window, { fromU: 10.3, toU: 10.3 + wide, fromV: 0, toV: 5 })).toBe(true);
    }
  });

  it('is not made for a view too far out to see worked ground in', () => {
    expect(windowFor({ fromU: 0, toU: WIDEST, fromV: 0, toV: 10 })).toBeNull();
  });

  it('holds each worn diamond inside it at its place, row by row, and leaves out the rest', () => {
    const window = { u: 10, v: 20, width: 4, height: 3 };
    const worked = new Map([
      [diamondKey(10, 20), WORKED.footprint],
      [diamondKey(13, 22), WORKED.ring],
      [diamondKey(14, 22), WORKED.ring],
      [diamondKey(9, 20), WORKED.ring],
    ] as const);
    const bytes = fillWindow(worked, window);
    expect(bytes[0]).toBe(WORKED.footprint);
    expect(bytes[2 * 4 + 3]).toBe(WORKED.ring);
    expect([...bytes].filter((byte) => byte !== 0)).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';

import { bridgeKindByte, roadKindByte } from '@villages/world/build';

import { stripsOf } from './roadStrips';

const widths = { track: 0.7, road: 1, trunk: 1.4, bridge: 1 };
const road = { ax: 100, ay: 100, bx: 110, by: 100, kind: roadKindByte('road') };

describe('the roads as stretches to draw', () => {
  it('are every piece whole, as wide as its grade times the lever, with the fog off', () => {
    const [strip, ...rest] = stripsOf([road], widths, 1.3, null);
    expect(rest).toEqual([]);
    expect(strip).toMatchObject({ ax: 100, ay: 100, bx: 110, by: 100, grade: 1, bridge: false });
    expect(strip!.half).toBeCloseTo(0.65, 9);
  });

  it('stop where the revealed ground stops, and start again where it starts', () => {
    // Revealed west of 103 and east of 107.
    const strips = stripsOf([road], widths, 1, (x) => x < 103 || x > 107);
    expect(strips).toHaveLength(2);
    expect(strips[0]!.ax).toBe(100);
    expect(strips[0]!.bx).toBeGreaterThan(102.5);
    expect(strips[0]!.bx).toBeLessThan(103);
    expect(strips[1]!.ax).toBeGreaterThan(107);
    expect(strips[1]!.ax).toBeLessThan(107.5);
    expect(strips[1]!.bx).toBe(110);
  });

  it('are none where nothing is revealed', () => {
    expect(stripsOf([road], widths, 1, () => false)).toEqual([]);
  });

  it('keep a bridge apart, as wide as a bridge', () => {
    const [strip] = stripsOf([{ ...road, kind: bridgeKindByte('uv') }], widths, 1, null);
    expect(strip).toMatchObject({ bridge: true, half: 0.5 });
  });
});

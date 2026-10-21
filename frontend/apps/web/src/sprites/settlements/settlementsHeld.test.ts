import { describe, expect, it } from 'vitest';

import type { SettlementRecord, SettlementsMapFile } from '@villages/world';

import { settlementAt, settlementOnItsSquare, settlementsHeld } from './settlementsHeld';

const map: SettlementsMapFile = {
  master: 'test',
  layer: 'settlements',
  at: '2026-10-21T12:00:00.000Z',
  world: { side: 32768, tileUnits: 256 },
  settlements: [
    { id: 'ruin:Q1792:0', name: 'village by the ruins of Dantzic' },
    { id: 'site:1:1', name: 'fishing village on the Vistula' },
  ],
};
const dantzic: SettlementRecord = { x: 100, y: 100, radius: 14, type: 'village', level: 3, index: 0 };
const vistula: SettlementRecord = { x: 110, y: 100, radius: 5, type: 'fishingVillage', level: 1, index: 1 };

describe('the settlements the page holds', () => {
  it('are each once, though sent in every tile their circle touches, and named by the map', () => {
    const held = settlementsHeld(map, [[dantzic], [dantzic, vistula], [vistula]]);
    expect(held.map((one) => one.name)).toEqual([
      'village by the ruins of Dantzic',
      'fishing village on the Vistula',
    ]);
    expect(held[0]).toMatchObject({ id: 'ruin:Q1792:0', type: 'village', level: 3, radius: 14 });
  });

  it('are none until the map is read, and leave out a record the map does not name', () => {
    expect(settlementsHeld(null, [[dantzic]])).toEqual([]);
    expect(settlementsHeld(map, [[{ ...dantzic, index: 7 }]])).toEqual([]);
  });

  it('hold a point within one radius, and where two overlap, the nearer middle', () => {
    const held = settlementsHeld(map, [[dantzic, vistula]]);
    expect(settlementAt(held, 102, 100)?.index).toBe(0);
    // Within both circles, nearer the fishing village's middle.
    expect(settlementAt(held, 108, 100)?.index).toBe(1);
    expect(settlementAt(held, 100, 130)).toBeNull();
  });

  it('are opened by a click on their square of ground, as wide as their level, the nearer middle where two are', () => {
    const held = settlementsHeld(map, [[dantzic, vistula]]);
    expect(settlementOnItsSquare(held, 100.4, 100.4)?.index).toBe(0);
    // A large village's square is nineteen diamonds a side, a hamlet's seven, laid round the corner of its middle.
    expect(settlementOnItsSquare(held, 92, 100)?.index).toBe(0);
    expect(settlementOnItsSquare(held, 112.5, 100)?.index).toBe(1);
    expect(settlementOnItsSquare(held, 120, 100)).toBeNull();
    expect(settlementOnItsSquare(settlementsHeld(map, [[vistula]]), 104, 100)).toBeNull();
  });
});

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { decodeSettlements, encodeSettlements } from './settlementRecords.ts';
import type { SettlementRecord } from './settlementRecords.ts';

interface Fixture {
  tileUnits: number;
  tile: { x: number; y: number };
  records: string;
  settlements: (SettlementRecord & { reach: number })[];
}
const fixture = JSON.parse(
  readFileSync(new URL('../../../../contracts/fixtures/settlement-records.json', import.meta.url), 'utf8'),
) as Fixture;

describe("the settlements' records", () => {
  it('decode to the settlements the shared fixture lists, and encode back to its bytes', () => {
    const records = new Uint8Array(Buffer.from(fixture.records, 'base64'));
    const read = decodeSettlements(records, fixture.tile.x, fixture.tile.y, fixture.tileUnits);
    expect(read).toEqual(
      fixture.settlements.map((one) => ({
        x: one.x,
        y: one.y,
        radius: one.radius,
        type: one.type,
        level: one.level,
        index: one.index,
      })),
    );
    const written = encodeSettlements(read, fixture.tile.x, fixture.tile.y, fixture.tileUnits);
    expect(Buffer.from(written).toString('base64')).toBe(fixture.records);
  });

  it('carry a settlement of every type and level, and a number past a byte', () => {
    for (const type of ['village', 'fishingVillage'] as const) {
      for (const level of [1, 2, 3]) {
        const one = { x: 10.5, y: 20.25, radius: 9.75, type, level, index: 65_000 };
        expect(decodeSettlements(encodeSettlements([one], 0, 0, 256), 0, 0, 256)).toEqual([one]);
      }
    }
  });
});

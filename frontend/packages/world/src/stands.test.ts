import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { STAND_BYTES, decodeStands, encodeStands } from './stands.ts';

interface Fixture {
  tileUnits: number;
  tile: { x: number; y: number };
  records: string;
  stands: { x: number; y: number; reach: number; dominant: number; thickness: number; seed: number }[];
}

/** The records the gateway reads its stands out of and the stands frame carries, shared with the Kotlin side. */
const fixture = JSON.parse(
  readFileSync(new URL('../../../../contracts/fixtures/stands.json', import.meta.url), 'utf8'),
) as Fixture;
const records = new Uint8Array(Buffer.from(fixture.records, 'base64'));

describe('the stand records both ends read', () => {
  it('decode to the stands the shared fixture lists, every field of every one', () => {
    const chunk = decodeStands(records, fixture.tile.x, fixture.tile.y, fixture.tileUnits);

    expect(chunk.count).toBe(fixture.stands.length);
    fixture.stands.forEach((stand, at) => {
      expect(chunk.x[at]).toBe(stand.x);
      expect(chunk.y[at]).toBe(stand.y);
      expect(chunk.reach[at]).toBe(stand.reach);
      expect(chunk.dominant[at]).toBe(stand.dominant);
      expect(chunk.thickness[at]).toBeCloseTo(stand.thickness, 6);
      expect(chunk.seed[at]).toBe(stand.seed);
    });
  });

  it('are what the generator writes for those stands, byte for byte', () => {
    const written = encodeStands(fixture.stands, fixture.tile.x, fixture.tile.y, fixture.tileUnits);

    expect(written.length).toBe(fixture.stands.length * STAND_BYTES);
    expect(Buffer.from(written).toString('base64')).toBe(fixture.records);
  });
});

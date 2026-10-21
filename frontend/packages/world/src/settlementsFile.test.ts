import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { fileSettlements } from './settlementsFile.ts';

/** The sites as the game server reads them, shared with the Kotlin side. See decision record 0114. */
const fixture = JSON.parse(
  readFileSync(new URL('../../../../contracts/fixtures/settlements.json', import.meta.url), 'utf8'),
) as unknown;

describe('the settlement sites, filed for the game server', () => {
  it('are the shared fixture: a village by the ruins of Dantzic with its buildings, and a fishing village in open country', () => {
    const filed = fileSettlements('fixture', '2026-10-21T12:00:00.000Z', [
      {
        id: 'site:1130:325',
        type: 'fishingVillage',
        level: 1,
        name: 'fishing village on the Lake of Geneva',
        lng: 6.512345678,
        lat: 46.4512345678,
        by: null,
        radius: 5,
        buildings: [{ type: 'house', level: 1, at: [6.5130001234, 46.451] }],
      },
      {
        id: 'ruin:Q1792:0',
        type: 'village',
        level: 3,
        name: 'village by the ruins of Dantzic',
        lng: 18.71,
        lat: 54.42,
        by: 'Q1792',
        radius: 14,
        buildings: [
          { type: 'market', level: 1, at: [18.712, 54.421] },
          { type: 'mill', level: 1, at: [18.705, 54.4185] },
          { type: 'house', level: 1, at: [18.7111111111, 54.4222222222] },
        ],
      },
    ]);
    expect(filed).toEqual(fixture);
  });
});

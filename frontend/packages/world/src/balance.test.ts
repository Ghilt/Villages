import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseBalance } from './balance.ts';

const fixture = readFileSync(new URL('../../../../contracts/fixtures/balance.json', import.meta.url), 'utf8');
const world = readFileSync(new URL('../../../../world/catalogues/balance.json', import.meta.url), 'utf8');

describe('the balance', () => {
  it('reads the shared fixture as the server does, number for number', () => {
    const balance = parseBalance(fixture);

    expect(balance.roll).toEqual({
      price: 12,
      hand: 4,
      odds: { common: 60, uncommon: 30, rare: 9, legendary: 1 },
      grants: { common: 20, uncommon: 50, rare: 150, legendary: 500 },
    });
    expect(balance.omens).toEqual({
      weakForDays: 365,
      piousAt: 80,
      groundPresent: 0.2,
      riversWithinKm: 300,
      housesWithinKm: 120,
      mostHouses: 2,
      townsWithinKm: 100,
      mostTowns: 1,
    });
    expect(balance.islands.smallerThanKm2).toBe(3_500_000);
    expect(balance.newcomers).toEqual({ youngest: 16, oldest: 60 });
    expect(balance.challenge).toEqual({
      tugEnds: 80,
      buildingArrives: 12,
      pullShare: 0.25,
      integrityShare: 0.4,
      effectivenessLost: 15,
      slice: { power: 40, integrity: 60, summonCount: 2 },
    });
    expect(balance.said.challenge).toBe('A challenge.');
    expect(balance.houseBots).toEqual({ count: 250, apartKm: 50, beyondRuinKm: 5 });
    expect(balance.settlements).toEqual({ clearKm: 3 });
    expect(balance.said.roll).toBe('A roll.');
  });

  it('reads the real one, whose odds are out of a hundred', () => {
    const { roll } = parseBalance(world);
    expect(Object.values(roll.odds).reduce((sum, chance) => sum + chance, 0)).toBe(100);
  });

  it('refuses a number it cannot read, naming where', () => {
    expect(() => parseBalance(fixture.replace('"hand": 4', '"hand": "four"'))).toThrow(
      'world/catalogues/balance.json: no roll.hand the page can read',
    );
  });
});

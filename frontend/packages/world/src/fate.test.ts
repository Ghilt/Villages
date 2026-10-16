import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { dealFrom, opensOn, parseFate } from './fate.ts';

const fixture = readFileSync(new URL('../../../../contracts/fixtures/fate.json', import.meta.url), 'utf8');
const world = readFileSync(new URL('../../../../world/catalogues/fate.json', import.meta.url), 'utf8');

describe('the pools and the actions', () => {
  it('reads the shared fixture as the server does', () => {
    const fate = parseFate(fixture);

    expect(fate.pools).toEqual([
      { name: 'Hearth', opensOn: [] },
      { name: 'Coin', opensOn: ['map.river', 'window.river*'] },
    ]);
    expect(fate.actions.map((action) => action.id)).toEqual(['wealth.common', 'piety.rare', 'gossip.common']);
    expect(fate.actions[1]).toMatchObject({
      rarity: 'rare',
      pools: ['Hearth'],
      deals: { kind: 'grant', resource: 'piety' },
    });
    expect(fate.actions[2]!.deals).toEqual({
      kind: 'gossip',
      spreads: 7,
      heardOfKm: 900,
      rumours: ['keeps a horse it cannot afford', 'has quarrelled with its priest'],
    });
    expect(fate.said.pools).toBe('Two pools.');
  });

  it('reads the real one, every action in Hearth', () => {
    const fate = parseFate(world);
    expect(fate.actions.filter((action) => !action.pools.includes('Hearth'))).toEqual([]);
  });

  it('refuses an action that is neither a grant nor gossip, or both, naming it', () => {
    expect(() =>
      parseFate(fixture.replace('"grants": "wealth"', '"grants": "wealth", "gossip": {}')),
    ).toThrow(
      'world/catalogues/fate.json: no actions.wealth.common.grants or gossip, and only one, the page can read',
    );
  });
});

describe('a deal from the pools and the actions', () => {
  const fate = parseFate(fixture);

  it('opens Hearth always, and a pool on a key exactly or on every key beginning with what comes before its star', () => {
    const coin = fate.pools[1]!;
    expect(
      ['map.river', 'window.river', 'window.river:Q548', 'map.rivers'].map((key) => opensOn(coin, key)),
    ).toEqual([true, true, true, false]);
    expect(dealFrom(fate, []).opened).toEqual(['Hearth']);
    expect(dealFrom(fate, ['map.river']).opened).toEqual(['Hearth', 'Coin']);
  });

  it('weighs each action by the open pools it is in, and shares the first draw by weight', () => {
    const commons = dealFrom(fate, ['map.river']).weighed.get('common')!;
    expect(commons.map(({ action, weight, share }) => [action.id, weight, share])).toEqual([
      ['wealth.common', 2, 0.5],
      ['gossip.common', 2, 0.5],
    ]);
  });
});

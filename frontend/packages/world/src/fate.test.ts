import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseFate } from './fate.ts';

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

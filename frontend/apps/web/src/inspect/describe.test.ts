import { describe, expect, it } from 'vitest';

import { dayOf } from '@villages/protocol';

import { describeCharacter } from './describe';
import type { CharacterSeen } from './describe';

const today = dayOf(1790, 5, 9);

const ravenscar = {
  id: '6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a',
  name: 'Ravenscar',
  banner: { field: 'sable', division: 'plain', charge: 'stag', chargeTincture: 'argent' },
} as const;

function agnes(over: Partial<CharacterSeen> = {}): CharacterSeen {
  return {
    id: 'cb732500-39bd-3b39-a838-bb89f719578f',
    givenName: 'Agnes',
    familyName: 'Hollin',
    sex: 'woman',
    bornOn: dayOf(1756, 2, 1),
    agedYears: 0,
    portrait: 'woman-03',
    keyFigureOf: [ravenscar],
    place: { lat: 59.34, lon: 18.06 },
    ...over,
  };
}

describe('a window on a character', () => {
  it('says who they are, how old, whom they serve and where they stand, with their face', () => {
    const said = describeCharacter(agnes(), today, false);

    expect(said.kind).toBe('Key figure');
    expect(said.name).toBe('Agnes Hollin');
    expect(said.under).toBe('a woman of 34');
    expect(said.likeness).toEqual({ portrait: 'woman-03' });
    expect(said.facts).toEqual([
      { what: 'Age', said: '34' },
      { what: 'Serves', said: 'Ravenscar' },
      { what: 'Stands', said: '59.340, 18.060' },
    ]);
  });

  it('leads to where they stand and to each house that holds them', () => {
    const said = describeCharacter(agnes(), today, false);

    expect(said.links).toEqual([
      { what: 'show them on the map', to: 'map', at: { lat: 59.34, lon: 18.06 } },
      { what: 'Ravenscar', to: 'subject', subject: { kind: 'house', id: ravenscar.id } },
    ]);
  });

  // Their stats are their house's own, and this window is anybody's.
  it('says nothing of their stats, and names them yours when they are', () => {
    const said = describeCharacter(agnes(), today, true);

    expect(said.kind).toBe('Your key figure');
    expect(said.facts.map((fact) => fact.what)).not.toContain('Piety');
  });

  it('draws a face for somebody with no portrait, and says when they are on no map', () => {
    const said = describeCharacter(agnes({ portrait: undefined, place: undefined }), today, true);

    expect(said.likeness).toEqual({ portrait: undefined });
    expect(said.facts).toContainEqual({ what: 'Stands', said: 'on no map' });
    expect(said.links.map((link) => link.to)).toEqual(['subject']);
  });
});

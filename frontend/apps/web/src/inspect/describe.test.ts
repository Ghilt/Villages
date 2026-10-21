import { describe, expect, it } from 'vitest';

import { dayOf } from '@villages/protocol';

import type { StructureView } from '@villages/protocol';
import type { StructureTypeSpec } from '@villages/world';

import { portraitUrl } from '../figures/portraits';
import { describeCharacter, describeStructure, givesOf, socketsSaid } from './describe';
import { describeSettlement } from './describeSettlement';
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

describe("a structure's window", () => {
  const abbey: StructureView = {
    id: '5d000000-0000-4000-8000-000000000001',
    structureType: 'abbey',
    name: 'the Antarctic abbey',
    place: { lat: -63.229, lon: -55.91 },
    cell: '2123302003',
    level: 2,
    significance: 19,
    since: 654635,
    stamp: 8,
  };
  const spec = {
    type: 'abbey',
    words: { european: 'abbey' },
    levels: 3,
    sightKm: [10, 12, 14],
    yields: { piety: [2, 3, 5], reason: [1, 2, 3] },
  } as unknown as StructureTypeSpec;

  it("names it, says what it is in the catalogue's word, and that nobody holds it", () => {
    const said = describeStructure(abbey, spec, false);

    expect([said.kind, said.name, said.under]).toEqual(['Structure', 'the Antarctic abbey', 'an abbey']);
    expect(said.facts.map((fact) => `${fact.what}: ${fact.said}`)).toEqual([
      'Held by: nobody',
      'Level: 2 of 3',
      'Yields: Reason +2 a month, Piety +3 a month',
      'Sees: 12 km around',
      'Stands: -63.229, -55.910',
    ]);
    expect(said.links).toEqual([{ what: 'show it on the map', to: 'map', at: abbey.place }]);
  });

  it('is one of your holdings when your house holds it, with a way to the house that does', () => {
    const said = describeStructure({ ...abbey, holder: ravenscar }, spec, true);

    expect(said.kind).toBe('Your holding');
    expect(said.facts[0]).toEqual({ what: 'Held by', said: 'Ravenscar' });
    expect(said.links[1]).toEqual({
      what: 'Ravenscar',
      to: 'subject',
      subject: { kind: 'house', id: ravenscar.id },
    });
  });

  it('names it in the word of the culture it is built in', () => {
    const worded = {
      ...spec,
      words: { european: 'abbey', islamic: 'zawiya' },
    } as unknown as StructureTypeSpec;

    expect(describeStructure(abbey, worded, false, 'islamic').under).toBe('a zawiya');
    expect(describeStructure(abbey, worded, false, null).under).toBe('an abbey');
  });

  it('says it is a ruin, of what, held by nobody', () => {
    const said = describeStructure({ ...abbey, ruin: true }, spec, false);

    expect([said.kind, said.under, said.facts[0]?.said]).toEqual(['Ruin', 'the ruin of an abbey', 'nobody']);
    expect(
      said.facts.filter((fact) => fact.what === 'Yields' || fact.what === 'Sees').map((fact) => fact.said),
    ).toEqual(['nothing', 'nothing']);
  });

  it('says whose seat it is, when it is one', () => {
    expect(describeStructure({ ...abbey, holder: ravenscar, seatOf: ravenscar }, spec, true).under).toBe(
      'an abbey, the seat of Ravenscar',
    );
  });

  it('says which settlement it is part of, with a way to the settlement as a whole', () => {
    const said = describeStructure(abbey, spec, false, null, { index: 7, name: 'village by the Vistula' });

    expect(said.facts[1]).toEqual({ what: 'Part of', said: 'the village by the Vistula' });
    expect(said.links[1]).toEqual({
      what: 'part of the village by the Vistula',
      to: 'subject',
      subject: { kind: 'settlement', id: '7' },
    });
  });

  it('says a type the catalogue has not told it of in its own name, spoken', () => {
    const said = describeStructure({ ...abbey, structureType: 'printingHouse' }, undefined, false);

    expect(said.under).toBe('a printing house');
    expect(said.facts[1]).toEqual({ what: 'Level', said: '2' });
  });
});

describe("a settlement's window", () => {
  const house = (
    id: string,
    structureType = 'house',
    place = { lat: 54.361, lon: 18.646 },
  ): StructureView => ({
    id,
    structureType,
    name: `${structureType} in the village by the ruins of Dantzic`,
    place,
    cell: '2123302003',
    level: 1,
    significance: 1,
    since: 654635,
    stamp: 1,
  });
  const village = {
    name: 'village by the ruins of Dantzic',
    type: 'village' as const,
    level: 2,
    at: { lat: 54.351, lon: 18.646 },
  };

  it('names it, says what it is and that nobody holds it, and counts the buildings in it by their type', () => {
    const said = describeSettlement(village, [house('a'), house('b'), house('c', 'mill')]);

    expect([said.kind, said.name, said.under]).toEqual([
      'Settlement',
      'Village by the ruins of Dantzic',
      'a village, held by nobody',
    ]);
    expect(said.facts.map((fact) => `${fact.what}: ${fact.said}`)).toEqual([
      'Buildings: 2 houses, a mill',
      'Stands: 54.351, 18.646',
    ]);
  });

  it('leads to where it stands and to every structure in it, each by which way it stands from the middle', () => {
    const said = describeSettlement(village, [
      house('a'),
      house('b', 'house', { lat: 54.351, lon: 18.66 }),
      house('c', 'mill', { lat: 54.3515, lon: 18.6465 }),
      { ...house('d', 'castle', { lat: 54.341, lon: 18.646 }), name: 'Castle Erebus' },
    ]);

    expect(said.links).toEqual([
      { what: 'show it on the map', to: 'map', at: village.at },
      { what: 'a house to the north', to: 'subject', subject: { kind: 'structure', id: 'a' } },
      { what: 'a house to the east', to: 'subject', subject: { kind: 'structure', id: 'b' } },
      { what: 'Castle Erebus', to: 'subject', subject: { kind: 'structure', id: 'd' } },
      { what: 'a mill by the green', to: 'subject', subject: { kind: 'structure', id: 'c' } },
    ]);
  });

  it('says a fishing village is by the water, and when no building of it is in view', () => {
    const said = describeSettlement({ ...village, type: 'fishingVillage', level: 1 }, []);

    expect(said.under).toBe('a hamlet by the water, held by nobody');
    expect(said.facts[0]).toEqual({ what: 'Buildings', said: 'none in view' });
  });
});

describe('what a structure gives, in its window', () => {
  it("is what its holder is paid when the server says so, and its type's at its level otherwise", () => {
    const spec = { yields: { wealth: [6, 12] } } as unknown as StructureTypeSpec;
    const mill = { level: 2 } as unknown as StructureView;

    expect(givesOf(mill, spec)).toBe('Wealth +12 a month');
    expect(givesOf({ ...mill, yields: { wealth: 12, piety: 2 } }, spec)).toBe(
      'Wealth +12 a month, Piety +2 a month',
    );
  });
});

describe("a structure's slots in its window", () => {
  it('are a portrait for a person, an item and its amount, and a question in every place of one not seen into', () => {
    expect(
      socketsSaid([
        {
          name: 'dungeon',
          places: 2,
          contents: [{ kind: 'person', id: 'a', name: 'Agnes Hollin', portrait: 'woman-04' }],
        },
        {
          name: 'garrison',
          places: 1,
          contents: [{ kind: 'item', id: 'b', name: 'a garrison', amount: 40 }],
        },
        { name: 'cells', places: 4 },
      ]),
    ).toEqual([
      {
        name: 'dungeon',
        places: 2,
        contents: [{ kind: 'portrait', picture: portraitUrl('woman-04'), name: 'Agnes Hollin' }],
      },
      { name: 'garrison', places: 1, contents: [{ kind: 'item', name: 'a garrison', amount: 40 }] },
      { name: 'cells', places: 4, contents: null },
    ]);
  });

  it('are absent from a window on one seen no longer, which the wire sends without them', () => {
    expect(socketsSaid(undefined)).toBeUndefined();
  });
});

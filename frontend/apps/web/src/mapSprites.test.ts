import { describe, expect, it } from 'vitest';

import type { StructureView } from '@villages/protocol';
import type { StructureCatalogue, StructureTypeSpec } from '@villages/world';

import { onACorner } from './geometry/footing';
import { toStructureSprite } from './mapSprites';
import { tinctureColour } from './sprites/tinctures';

/** A type as the catalogue would read it, by the heights it stands at, a level at a time. */
const type = (name: string, groundHeight: number[]): StructureTypeSpec => ({
  type: name,
  words: { european: name, islamic: name, eastAsian: name, african: name },
  levels: groundHeight.length,
  significance: groundHeight.map(() => 10),
  sightKm: groundHeight.map(() => 10),
  groundHeight,
  footprint: groundHeight.map(() => 3),
  yields: {},
  zone: null,
  slots: [],
});

const CATALOGUE: StructureCatalogue = { types: [type('castle', [4, 4.5, 5]), type('mill', [2.4, 2.7, 3])] };

const RAVENSCAR = {
  id: 'h',
  name: 'Ravenscar',
  banner: { field: 'gules', division: 'plain', charge: 'stag', chargeTincture: 'argent' } as const,
};

function structure(structureType: string, level: number, holder?: typeof RAVENSCAR): StructureView {
  return {
    id: 'a',
    structureType,
    name: 'Castle Erebus',
    place: { lat: -78.4, lon: -77.4 },
    cell: '2',
    level,
    ...(holder === undefined ? {} : { holder }),
    significance: 20,
    since: 653705,
    stamp: 3,
  };
}

describe('a structure as the map draws it', () => {
  it('is drawn by its type, as tall as the catalogue says at its level, on the corner of the diamonds nearest its place', () => {
    const drawn = toStructureSprite(structure('castle', 2), CATALOGUE);

    expect(drawn).toMatchObject({
      id: 'structure:a',
      at: onACorner({ lng: -77.4, lat: -78.4 }),
      kind: 'structure',
      structure: { picture: 'castle@european', groundHeight: 4.5 },
    });
  });

  it('stands at the highest level the catalogue has, for a level beyond it', () => {
    expect(toStructureSprite(structure('mill', 7), CATALOGUE).structure?.groundHeight).toBe(3);
  });

  it("flies its holder's field as its pennant, and none when nobody holds it", () => {
    expect(toStructureSprite(structure('mill', 1, RAVENSCAR), CATALOGUE).pennant).toBe(
      tinctureColour('gules'),
    );
    expect(toStructureSprite(structure('mill', 1), CATALOGUE)).not.toHaveProperty('pennant');
  });

  it('is untinted, because a structure is drawn in its own colours', () => {
    expect(toStructureSprite(structure('mill', 1, RAVENSCAR), CATALOGUE).tint).toBe(0xffffff);
  });

  it('leaves its height to the renderer before the catalogue is read, or for a type it does not know', () => {
    expect(toStructureSprite(structure('castle', 1), null).structure).toEqual({ picture: 'castle@european' });
    expect(toStructureSprite(structure('lodge', 1), CATALOGUE).structure).toEqual({
      picture: 'lodge@european',
    });
  });
});

describe('one of your holdings', () => {
  it('is said to be yours, which far out makes it a mark drawn at every zoom, and no other structure is', () => {
    expect(toStructureSprite(structure('castle', 1), null, null, true).yours).toBe(true);
    expect(toStructureSprite(structure('castle', 1), null)).not.toHaveProperty('yours');
  });
});

describe('a structure in a culture', () => {
  it('is drawn in the culture of the ground it stands on', () => {
    expect(toStructureSprite(structure('castle', 1), null, 'islamic').structure).toEqual({
      picture: 'castle@islamic',
    });
  });
});

describe('a ruin', () => {
  it('is drawn as a ruin, as tall as what it was, and flies no pennant', () => {
    const drawn = toStructureSprite({ ...structure('castle', 2), ruin: true }, CATALOGUE);

    expect(drawn.structure).toEqual({ picture: 'a ruin@european', groundHeight: 4.5 });
    expect(drawn).not.toHaveProperty('pennant');
  });
});

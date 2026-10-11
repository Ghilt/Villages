import { describe, expect, it } from 'vitest';

import type { CharacterOnMapView } from '@villages/protocol';

import {
  NOTHING_ARRIVED,
  NO_STANDS_ARRIVED,
  alsoArrived,
  alsoStood,
  describeArrival,
  describeBatch,
  describeStands,
} from './arrivals';

const snapshot = (cell: string, houses: number, omitted?: number, characters = 0, structures = 0) => ({
  cell,
  houses: Array.from({ length: houses }, (_, index) => index),
  ...(omitted === undefined ? {} : { omitted }),
  characters: Array.from({ length: characters }, (_, index) => index),
  structures: Array.from({ length: structures }, (_, index) => index),
});

/** A burst of snapshots, folded in the order they arrived. */
const burst = (...frames: ReturnType<typeof snapshot>[]) => frames.reduce(alsoArrived, NOTHING_ARRIVED);

describe('counting a burst of snapshots', () => {
  it('adds the cells and what they carried', () => {
    const counted = burst(snapshot('12003122', 2), snapshot('12003123', 0), snapshot('12003132', 1));

    expect(counted.cells).toBe(3);
    expect(counted.houses).toBe(3);
    expect(counted.zoom).toBe(8);
  });

  it('adds what the cells held beyond what they sent', () => {
    expect(burst(snapshot('1200', 200, 40), snapshot('1201', 200, 2)).omitted).toBe(42);
  });

  it('names the whole world by its own depth, which is none', () => {
    expect(burst(snapshot('', 1)).zoom).toBe(0);
  });
});

describe('saying what arrived', () => {
  it('says nothing about a burst that brought nothing, because a pan is not news', () => {
    expect(describeArrival(burst(snapshot('12', 0), snapshot('13', 0)))).toBeNull();
    expect(describeArrival(NOTHING_ARRIVED)).toBeNull();
  });

  it('says how many cells answered, at what depth, and what they held', () => {
    expect(describeArrival(burst(snapshot('12', 21), snapshot('03', 21)))).toBe('2 cells at z2: 42 houses');
  });

  it('counts one of anything in the singular', () => {
    expect(describeArrival(burst(snapshot('1200312213', 1)))).toBe('1 cell at z10: 1 house');
  });

  it('says what was left out, because a screen showing most of a crowd should say so', () => {
    expect(describeArrival(burst(snapshot('1200', 200, 30)))).toBe(
      '1 cell at z4: 200 houses, 30 more not sent',
    );
  });

  it('says the characters standing in the cells, and only when there are some', () => {
    expect(describeArrival(burst(snapshot('1200312213', 1, undefined, 2)))).toBe(
      '1 cell at z10: 1 house, 2 characters',
    );
    expect(describeArrival(burst(snapshot('1200312213', 0, undefined, 1)))).toBe(
      '1 cell at z10: 0 houses, 1 character',
    );
  });

  it('says the structures standing in the cells, and only when there are some', () => {
    expect(describeArrival(burst(snapshot('1200312213', 0, undefined, 0, 16)))).toBe(
      '1 cell at z10: 0 houses, 16 structures',
    );
    expect(describeArrival(burst(snapshot('1200312213', 1, undefined, 1, 1)))).toBe(
      '1 cell at z10: 1 house, 1 character, 1 structure',
    );
  });

  it('speaks up for a cell that sent nothing but holds something, which is the cap talking', () => {
    expect(describeArrival(burst(snapshot('', 0, 7)))).toBe('1 cell at z0: 0 houses, 7 more not sent');
  });
});

describe('saying what a batch brought', () => {
  const agnes: CharacterOnMapView = {
    id: 'cb732500-39bd-3b39-a838-bb89f719578f',
    givenName: 'Agnes',
    familyName: 'Hollin',
    sex: 'woman',
    species: 'person',
    bornOn: 642700,
    agedYears: 0,
    place: { lat: 59.34, lon: 18.06 },
    cell: '1200312213',
    keyFigureOf: [],
    since: 653705,
    version: 9,
  };
  const nobody = () => undefined;

  it('counts the deltas, and names nobody when only houses changed', () => {
    const house = {
      id: 'h',
      name: 'Ravenscar',
      cell: '12003122',
      seat: { lat: 59.33, lon: 18.07 },
      banner: { field: 'sable', division: 'plain', charge: 'stag', chargeTincture: 'argent' } as const,
      since: 437635,
      version: 1,
    };

    expect(describeBatch([{ type: 'houseChanged', house }], nobody)).toBe('1 delta in one batch');
  });

  it('names every character who arrived, moved or went', () => {
    expect(
      describeBatch(
        [
          { type: 'characterArrived', character: agnes },
          { type: 'characterChanged', character: agnes },
          { type: 'characterGone', id: agnes.id, version: 11 },
        ],
        (id) => (id === agnes.id ? 'Agnes Hollin' : undefined),
      ),
    ).toBe('3 deltas in one batch: Agnes Hollin arrived, Agnes Hollin moved, Agnes Hollin went');
  });

  it('falls back to the id for somebody gone who was never known here', () => {
    expect(describeBatch([{ type: 'characterGone', id: agnes.id, version: 11 }], nobody)).toBe(
      '1 delta in one batch: cb732500 went',
    );
  });

  const mill = {
    id: '5d000000-0000-4000-8000-000000000001',
    structureType: 'mill',
    name: 'a new mill',
    place: { lat: 59.33, lon: 18.07 },
    cell: '1200312213',
    level: 1,
    significance: 10,
    since: 653705,
    stamp: 13,
  };

  it('names every structure raised, as it names a person arriving', () => {
    expect(describeBatch([{ type: 'structureArrived', structure: mill }], nobody)).toBe(
      '1 delta in one batch: a new mill raised',
    );
  });

  it('names a structure that changed and who holds it now, nobody included', () => {
    const ravenscar = {
      id: 'h',
      name: 'Ravenscar',
      banner: { field: 'sable', division: 'plain', charge: 'stag', chargeTincture: 'argent' } as const,
    };

    expect(
      describeBatch(
        [
          { type: 'structureChanged', structure: { ...mill, holder: ravenscar, stamp: 14 } },
          { type: 'structureChanged', structure: { ...mill, stamp: 15 } },
        ],
        nobody,
      ),
    ).toBe(
      '2 deltas in one batch: a new mill changed, held by Ravenscar, a new mill changed, held by nobody',
    );
  });
});

describe('saying what stands arrived', () => {
  // Three stands, as the shared fixture writes them, and a tile with none.
  const three = { stands: 'OADd/xoNXyr/BwQE//+w/57/YAkBAAEA' };
  const none = { stands: '' };

  it('counts the tiles and the stands in them, off the length of the base64', () => {
    expect(alsoStood(alsoStood(NO_STANDS_ARRIVED, three), none)).toEqual({ tiles: 2, stands: 3 });
    expect(alsoStood(NO_STANDS_ARRIVED, { stands: 'AAAAAAAAAAA=' })).toEqual({ tiles: 1, stands: 1 });
  });

  it('says nothing about tiles that brought no stands, because empty or unseen ground is not news', () => {
    expect(describeStands(alsoStood(NO_STANDS_ARRIVED, none))).toBeNull();
  });

  it('says how many tiles answered and how many stands the fog let through', () => {
    expect(describeStands({ tiles: 4, stands: 612 })).toBe('4 tiles from the server: 612 stands');
    expect(describeStands({ tiles: 1, stands: 1 })).toBe('1 tile from the server: 1 stand');
  });
});

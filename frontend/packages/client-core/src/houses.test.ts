import { describe, expect, it } from 'vitest';

import type { CharacterOnMapView, HouseView, ServerFrame } from '@villages/protocol';

import {
  NO_HOUSES,
  cellsHeld,
  charactersInView,
  forgetCells,
  holdCells,
  housesInView,
  omittedInView,
  reduceHouses,
} from './houses';

/** Stockholm's cell at three depths, from the shared vectors. */
const Z10 = '1200312213';
const Z8 = '12003122';
const Z4 = '1200';

function house(id: string, version = 1, cell = Z10): HouseView {
  return {
    id,
    name: `House ${id}`,
    cell,
    seat: { lat: 59.33, lon: 18.07 },
    banner: { field: 'sable', division: 'plain', charge: 'stag', chargeTincture: 'argent' },
    since: 437635,
    version,
  };
}

const snapshot = (cell: string, houses: HouseView[], omitted?: number): ServerFrame => ({
  type: 'snapshot',
  cell,
  houses,
  asOfVersion: 1,
  ...(omitted === undefined ? {} : { omitted }),
});

const appeared = (...houses: HouseView[]): ServerFrame => ({
  type: 'batch',
  deltas: houses.map((h) => ({ type: 'houseAppeared' as const, house: h })),
});

const changed = (...houses: HouseView[]): ServerFrame => ({
  type: 'batch',
  deltas: houses.map((h) => ({ type: 'houseChanged' as const, house: h })),
});

describe('holding cells', () => {
  it('holds a cell, empty, from the moment it is asked for', () => {
    const state = holdCells(NO_HOUSES, [Z8]);

    expect(cellsHeld(state)).toEqual([Z8]);
    expect(housesInView(state)).toEqual([]);
  });

  it('lets a cell go along with everything it held', () => {
    let state = holdCells(NO_HOUSES, [Z8]);
    state = reduceHouses(state, snapshot(Z8, [house('a')]));

    state = forgetCells(state, [Z8]);

    expect(cellsHeld(state)).toEqual([]);
    expect(housesInView(state)).toEqual([]);
  });
});

describe('a snapshot', () => {
  it('fills the cell it is for', () => {
    let state = holdCells(NO_HOUSES, [Z8]);

    state = reduceHouses(state, snapshot(Z8, [house('a'), house('b')]));

    expect(housesInView(state).map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('is ignored for a cell no longer held, because it was let go before the answer came', () => {
    const state = reduceHouses(holdCells(NO_HOUSES, [Z4]), snapshot(Z8, [house('a')]));

    expect(housesInView(state)).toEqual([]);
  });

  it('keeps a newer version that arrived as a delta before it, rather than rolling it back', () => {
    let state = holdCells(NO_HOUSES, [Z8]);
    state = reduceHouses(state, changed(house('a', 3)));

    state = reduceHouses(state, snapshot(Z8, [house('a', 2)]));

    expect(housesInView(state)[0]?.version).toBe(3);
  });

  it('drops the houses it no longer lists, which is how looking at an earlier day empties the map', () => {
    let state = holdCells(NO_HOUSES, [Z8]);
    state = reduceHouses(state, snapshot(Z8, [house('a'), house('b')]));

    state = reduceHouses(state, snapshot(Z8, []));

    expect(housesInView(state)).toEqual([]);
  });

  it('remembers how many more the cell held than it carried', () => {
    let state = holdCells(NO_HOUSES, [Z8, Z4]);
    state = reduceHouses(state, snapshot(Z8, [house('a')], 47));
    state = reduceHouses(state, snapshot(Z4, [], 3));

    expect(omittedInView(state)).toBe(50);
  });
});

describe('a batch of deltas', () => {
  it('lands in every held cell that contains the house, and nowhere else', () => {
    let state = holdCells(NO_HOUSES, [Z8, Z4, '30023103']);

    state = reduceHouses(state, appeared(house('a')));

    expect(state.byCell.get(Z8)?.has('a')).toBe(true);
    expect(state.byCell.get(Z4)?.has('a')).toBe(true);
    expect(state.byCell.get('30023103')?.has('a')).toBe(false);
    expect(housesInView(state)).toHaveLength(1);
  });

  it('replaces an older version and ignores a stale one', () => {
    let state = holdCells(NO_HOUSES, [Z8]);
    state = reduceHouses(state, snapshot(Z8, [house('a', 2)]));

    state = reduceHouses(state, changed(house('a', 1)));
    expect(housesInView(state)[0]?.version).toBe(2);

    state = reduceHouses(state, changed(house('a', 5)));
    expect(housesInView(state)[0]?.version).toBe(5);
  });

  it('leaves the state untouched when nothing it carries is for a held cell', () => {
    const state = holdCells(NO_HOUSES, ['30023103']);

    expect(reduceHouses(state, appeared(house('a')))).toBe(state);
  });
});

describe('what is drawn', () => {
  it('counts a house once however many held cells contain it', () => {
    let state = holdCells(NO_HOUSES, [Z8, Z4]);
    state = reduceHouses(state, snapshot(Z8, [house('a', 1)]));
    state = reduceHouses(state, snapshot(Z4, [house('a', 2)]));

    const drawn = housesInView(state);

    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.version).toBe(2);
  });

  it('is in a stable order, so a redraw does not shuffle', () => {
    let state = holdCells(NO_HOUSES, [Z8]);
    state = reduceHouses(state, snapshot(Z8, [house('c'), house('a'), house('b')]));

    expect(housesInView(state).map((h) => h.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('a resync', () => {
  it('empties the named cells, which stay held for the snapshots that will follow', () => {
    let state = holdCells(NO_HOUSES, [Z8, Z4]);
    state = reduceHouses(state, snapshot(Z8, [house('a')], 9));
    state = reduceHouses(state, snapshot(Z4, [house('b')]));

    state = reduceHouses(state, { type: 'resync', cells: [Z8] });

    expect(cellsHeld(state)).toEqual([Z8, Z4]);
    expect(housesInView(state).map((h) => h.id)).toEqual(['b']);
    expect(omittedInView(state)).toBe(0);
  });
});

describe('frames about other things', () => {
  it('change nothing', () => {
    const state = holdCells(NO_HOUSES, [Z8]);

    expect(reduceHouses(state, { type: 'pong', t0: 1, serverTime: 2 })).toBe(state);
  });
});

/** Helsinki's cell at zoom ten: somewhere a Stockholm cell does not reach. */
const HELSINKI_Z10 = '1201202110';

function character(id: string, version = 1, cell = Z10): CharacterOnMapView {
  return {
    id,
    givenName: 'Agnes',
    familyName: 'Hollin',
    sex: 'woman',
    species: 'person',
    bornOn: 642700,
    agedYears: 0,
    place: { lat: 59.34, lon: 18.06 },
    cell,
    keyFigureOf: [],
    since: 653705,
    version,
  };
}

const standing = (
  cell: string,
  characters: CharacterOnMapView[],
  omittedCharacters?: number,
): ServerFrame => ({
  type: 'snapshot',
  cell,
  houses: [],
  asOfVersion: 1,
  characters,
  ...(omittedCharacters === undefined ? {} : { omittedCharacters }),
});

const arrived = (who: CharacterOnMapView): ServerFrame => ({
  type: 'batch',
  deltas: [{ type: 'characterArrived', character: who }],
});

const movedTo = (who: CharacterOnMapView): ServerFrame => ({
  type: 'batch',
  deltas: [{ type: 'characterChanged', character: who }],
});

const gone = (id: string, version: number): ServerFrame => ({
  type: 'batch',
  deltas: [{ type: 'characterGone', id, version }],
});

describe('the characters standing in the held cells', () => {
  it('are what a snapshot says stands there, and a snapshot with nobody empties the cell of them', () => {
    let state = holdCells(NO_HOUSES, [Z8]);
    state = reduceHouses(state, standing(Z8, [character('agnes')]));

    expect(charactersInView(state).map((one) => one.id)).toEqual(['agnes']);

    state = reduceHouses(state, snapshot(Z8, []));
    expect(charactersInView(state)).toEqual([]);
  });

  it('arrive in every held cell their place is in, and in no other', () => {
    let state = holdCells(NO_HOUSES, [Z8, HELSINKI_Z10]);
    state = reduceHouses(state, arrived(character('agnes')));

    expect(state.charactersByCell.get(Z8)?.has('agnes')).toBe(true);
    expect(state.charactersByCell.get(HELSINKI_Z10)?.has('agnes')).toBe(false);
  });

  // The whole difference from a house: a character who moved is taken out of the cell they left.
  it('leave the held cells they moved out of, and stand in the ones they moved into', () => {
    let state = holdCells(NO_HOUSES, [Z8, HELSINKI_Z10]);
    state = reduceHouses(state, arrived(character('agnes')));
    state = reduceHouses(state, movedTo(character('agnes', 2, HELSINKI_Z10)));

    expect(state.charactersByCell.get(Z8)?.has('agnes')).toBe(false);
    expect(state.charactersByCell.get(HELSINKI_Z10)?.get('agnes')?.version).toBe(2);
    expect(charactersInView(state)).toHaveLength(1);
  });

  it('are taken out of every held cell when they are gone', () => {
    let state = holdCells(NO_HOUSES, [Z8, Z4]);
    state = reduceHouses(state, arrived(character('agnes')));
    state = reduceHouses(state, gone('agnes', 2));

    expect(charactersInView(state)).toEqual([]);
  });

  it('keep the newer copy when an older delta arrives after it', () => {
    let state = holdCells(NO_HOUSES, [Z8]);
    state = reduceHouses(state, arrived(character('agnes', 3)));
    state = reduceHouses(state, movedTo(character('agnes', 2, HELSINKI_Z10)));

    expect(state.charactersByCell.get(Z8)?.get('agnes')?.version).toBe(3);
  });

  it('go with the cells they stood in when those are let go', () => {
    let state = holdCells(NO_HOUSES, [Z8]);
    state = reduceHouses(state, arrived(character('agnes')));
    state = forgetCells(state, [Z8]);

    expect(charactersInView(state)).toEqual([]);
    expect(state.charactersByCell.has(Z8)).toBe(false);
  });

  it('are emptied from a cell the gateway let go of, until its fresh snapshot comes', () => {
    let state = holdCells(NO_HOUSES, [Z8]);
    state = reduceHouses(state, standing(Z8, [character('agnes')], 4));
    state = reduceHouses(state, { type: 'resync', cells: [Z8] });

    expect(charactersInView(state)).toEqual([]);
    expect(state.omittedCharacters.has(Z8)).toBe(false);
  });
});

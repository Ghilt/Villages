import { describe, expect, it } from 'vitest';

import type { CharacterOnMapView, ServerFrame } from '@villages/protocol';

import { NO_HOUSES, cellsHeld, charactersInView, forgetCells, holdCells, reduceHouses } from './houses';

/** Stockholm's cell at three depths, from the shared vectors. */
const Z10 = '1200312213';
const Z8 = '12003122';
const Z4 = '1200';

describe('holding cells', () => {
  it('holds a cell, empty, from the moment it is asked for', () => {
    const state = holdCells(NO_HOUSES, [Z8]);

    expect(cellsHeld(state)).toEqual([Z8]);
    expect(charactersInView(state)).toEqual([]);
  });

  it('lets a cell go along with everything it held', () => {
    let state = holdCells(NO_HOUSES, [Z8, Z4]);
    state = reduceHouses(state, standing(Z8, [character('a')]));

    state = forgetCells(state, [Z8]);

    expect(cellsHeld(state)).toEqual([Z4]);
    expect(charactersInView(state)).toEqual([]);
  });

  it('ignores a snapshot for a cell no longer held, because it was let go before the answer came', () => {
    const state = forgetCells(holdCells(NO_HOUSES, [Z8]), [Z8]);

    expect(reduceHouses(state, standing(Z8, [character('a')]))).toBe(state);
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

    state = reduceHouses(state, standing(Z8, []));
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

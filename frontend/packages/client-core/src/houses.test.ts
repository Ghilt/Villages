import { describe, expect, it } from 'vitest';

import type { HouseView, ServerFrame } from '@villages/protocol';

import {
  NO_HOUSES,
  cellsHeld,
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
    treasury: { amount: 0, ratePerSecond: 1, asOf: 0 },
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

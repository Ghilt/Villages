import { describe, expect, it } from 'vitest';

import type { ServerFrame, StructureView } from '@villages/protocol';

import { NOTHING_ON_THE_MAP, forgetCells, holdCells, reduceOnTheMap, structuresInView } from './onTheMap';

/** Stockholm's cell at three depths, from the shared vectors, and one in Helsinki that holds none of them. */
const Z10 = '1200312213';
const Z8 = '12003122';
const Z4 = '1200';
const HELSINKI_Z10 = '1201202110';

/** A mill, at a level and with the stamp of the face it is sent. */
function mill(id: string, stamp: number, level = 1, cell = Z10): StructureView {
  return {
    id,
    structureType: 'mill',
    name: `the mill ${id}`,
    place: { lat: 59.33, lon: 18.07 },
    cell,
    level,
    significance: 10,
    since: 653705,
    stamp,
  };
}

const snapshot = (cell: string, structures: StructureView[], structuresAsOf: number): ServerFrame => ({
  type: 'snapshot',
  cell,
  structures,
  structuresAsOf,
});

const raised = (structure: StructureView): ServerFrame => ({
  type: 'batch',
  deltas: [{ type: 'structureArrived', structure }],
});

const levels = (state: typeof NOTHING_ON_THE_MAP) =>
  structuresInView(state).map((one) => `${one.id}@${one.level}`);

describe('the structures standing in the held cells', () => {
  it('are what a snapshot says stands there', () => {
    const state = reduceOnTheMap(
      holdCells(NOTHING_ON_THE_MAP, [Z8]),
      snapshot(Z8, [mill('a', 3), mill('b', 4)], 9),
    );

    expect(levels(state)).toEqual(['a@1', 'b@1']);
  });

  it('arrive in every held cell that contains them, and in no other', () => {
    const state = reduceOnTheMap(holdCells(NOTHING_ON_THE_MAP, [Z8, Z4, HELSINKI_Z10]), raised(mill('a', 3)));

    expect(state.structuresByCell.get(Z8)?.has('a')).toBe(true);
    expect(state.structuresByCell.get(Z4)?.has('a')).toBe(true);
    expect(state.structuresByCell.get(HELSINKI_Z10)?.has('a')).toBe(false);
  });

  it('keep the later face when an earlier one arrives after it', () => {
    let state = holdCells(NOTHING_ON_THE_MAP, [Z8]);
    state = reduceOnTheMap(state, raised(mill('a', 7, 2)));
    state = reduceOnTheMap(state, raised(mill('a', 3, 1)));

    expect(levels(state)).toEqual(['a@2']);
  });

  // The trap the stamp is for: a snapshot of an earlier day, or of ground no longer seen, sends the older face on
  // purpose, and keeping the higher of the two, as a house's version is kept, would show a face the house never saw.
  it('take the older face a snapshot sends over one held from before it was read', () => {
    let state = holdCells(NOTHING_ON_THE_MAP, [Z8]);
    state = reduceOnTheMap(state, raised(mill('a', 7, 2)));
    state = reduceOnTheMap(state, snapshot(Z8, [mill('a', 3, 1)], 9));

    expect(levels(state)).toEqual(['a@1']);
  });

  it('keep a face stamped after the snapshot was read, which came from a change it had not seen', () => {
    let state = holdCells(NOTHING_ON_THE_MAP, [Z8]);
    state = reduceOnTheMap(state, raised(mill('a', 12, 2)));
    state = reduceOnTheMap(state, raised(mill('b', 11)));
    state = reduceOnTheMap(state, snapshot(Z8, [mill('a', 3, 1)], 9));

    expect(levels(state)).toEqual(['a@2', 'b@1']);
  });

  it('are drawn once each, at the latest face any held cell has', () => {
    let state = holdCells(NOTHING_ON_THE_MAP, [Z8, Z4]);
    state = reduceOnTheMap(state, snapshot(Z4, [mill('a', 3, 1)], 3));
    state = reduceOnTheMap(state, snapshot(Z8, [mill('a', 5, 2)], 5));

    expect(levels(state)).toEqual(['a@2']);
  });

  it('go with the cells they stood in, and are emptied from one the gateway let go of', () => {
    let state = holdCells(NOTHING_ON_THE_MAP, [Z8, Z4]);
    state = reduceOnTheMap(state, snapshot(Z8, [mill('a', 3)], 3));
    state = reduceOnTheMap(state, {
      ...snapshot(Z4, [mill('b', 4, 1, Z8)], 4),
      omittedStructures: 2,
    } as ServerFrame);
    state = forgetCells(state, [Z8]);

    expect(levels(state)).toEqual(['b@1']);

    state = reduceOnTheMap(state, { type: 'resync', cells: [Z4] });
    expect(structuresInView(state)).toEqual([]);
    expect(state.omittedStructures.has(Z4)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { INITIAL_SESSION } from '@villages/client-core';
import type { SessionState } from '@villages/client-core';
import type { StructureView } from '@villages/protocol';

import { drawnIn, markedOf, peopleIn } from './onTheMapDrawn';

const seat = { id: 's', seatOf: { id: 'h' } } as unknown as StructureView;

describe('what the map draws, read from the session', () => {
  it('is the very list while what it is made from is the same, whatever else in the session changed', () => {
    const state: SessionState = INITIAL_SESSION;
    const drawn = drawnIn(state);
    const people = peopleIn(state);
    const elsewhere = { ...state, yourChoice: null, yourDialogues: null };
    expect(drawnIn(elsewhere)).toBe(drawn);
    expect(peopleIn(elsewhere)).toBe(people);
    expect(drawnIn({ ...state, yourHoldings: [seat] })).not.toBe(drawn);
    expect(drawnIn({ ...state, yourHoldings: [seat] })).toContain(seat);
  });

  it('marks a house by its seat, and anything else as it is', () => {
    expect(markedOf({ kind: 'house', id: 'h' }, [seat])).toEqual({ kind: 'structure', id: 's' });
    expect(markedOf({ kind: 'area', id: 'a' }, [seat])).toEqual({ kind: 'area', id: 'a' });
    expect(markedOf(undefined, [seat])).toBeUndefined();
  });
});

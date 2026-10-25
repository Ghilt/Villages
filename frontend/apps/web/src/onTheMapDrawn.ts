import { charactersInView, structuresInView } from '@villages/client-core';
import type { SessionState } from '@villages/client-core';
import type { CharacterOnMapView, StructureView } from '@villages/protocol';

import type { Subject } from './inspect/subjects';

/**
 * What the map draws, read from the session: each list worked out again only when what it is made from has changed,
 * so every part that reads it, however often it asks, is handed the very same list (`MapContents.tsx`).
 */

/** A list worked out from the session again only when what it is made from has changed. */
function remembering<A, B, T>(from: (state: SessionState) => [A, B], make: (a: A, b: B) => T) {
  let last: { a: A; b: B; made: T } | null = null;
  return (state: SessionState): T => {
    const [a, b] = from(state);
    if (last?.a !== a || last.b !== b) last = { a, b, made: make(a, b) };
    return last.made;
  };
}

/**
 * The structures drawn: those in the cells held and your own holdings, which are drawn whether or not a held cell
 * carries them and however far back the camera goes, because far out they are your marks. No house is drawn: its
 * structures are. See decision record 0096.
 */
export const drawnIn = remembering(
  (state) => [state.onTheMap, state.yourHoldings] as const,
  (onTheMap, holdings): readonly StructureView[] => {
    const raised = structuresInView(onTheMap);
    return holdings === null
      ? raised
      : [...raised, ...holdings.filter((one) => !raised.some((r) => r.id === one.id))];
  },
);

/** The people drawn: those standing in the cells held, and your key figures wherever they stand. */
export const peopleIn = remembering(
  (state) => [state.onTheMap, state.yourKeyFigures] as const,
  (
    onTheMap,
    keyFigures,
  ): readonly Pick<CharacterOnMapView, 'id' | 'givenName' | 'place' | 'keyFigureOf'>[] => {
    const standing = charactersInView(onTheMap);
    return [
      ...standing,
      ...(keyFigures ?? []).flatMap((one) =>
        one.place === undefined || standing.some((there) => there.id === one.id)
          ? []
          : [{ ...one, place: one.place }],
      ),
    ];
  },
);

export const yoursIn = (state: SessionState) => state.yourHouse?.house.id ?? null;

/** What the map marks: the newest thing opened, and for a house its seat, which is where a house is on the map. */
export function markedOf(top: Subject | undefined, drawn: readonly StructureView[]): Subject | undefined {
  const seat = top?.kind === 'house' ? drawn.find((one) => one.seatOf?.id === top.id) : undefined;
  return seat === undefined ? top : { kind: 'structure', id: seat.id };
}

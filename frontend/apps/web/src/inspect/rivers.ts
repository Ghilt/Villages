import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';
import type { InspectedFrame, RiverView } from '@villages/protocol';

/**
 * The rivers the server has named for this page's clicks, by the id their inspect windows are opened under: what
 * a window on a river says. The server's answers and nothing else, because a player learns a name from the server
 * and never from the page's own copy of the names (0087). Nothing here survives a reload.
 */

/** A river the server named for a click, and where the click was. */
export interface RiverSeen {
  readonly id: string;
  readonly river: RiverView;
  readonly at: { readonly lat: number; readonly lon: number };
}

const store = createStore<{ seen: ReadonlyMap<string, RiverSeen> }>({ seen: new Map() });

export const riversStore: Readable<{ seen: ReadonlyMap<string, RiverSeen> }> = store;

/**
 * Takes an answer in: the river it names, kept under its real identity so that two clicks on the Vistula are one
 * window, or under the place for one nobody has named; or null where the answer names no river.
 */
export function heardRiver(answer: InspectedFrame): RiverSeen | null {
  if (answer.river === null) {
    return null;
  }
  const id = answer.river.id ?? `at:${answer.at.lat.toFixed(3)},${answer.at.lon.toFixed(3)}`;
  const seen: RiverSeen = { id, river: answer.river, at: answer.at };
  store.set({ seen: new Map(store.get().seen).set(id, seen) });
  return seen;
}

/** What the log says of an answer, for the debug panel: the river by name, or why there is none. */
export function sayAnswer(answer: InspectedFrame): string {
  const { lat, lon } = answer.at;
  const where = `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;
  if (!answer.revealed) {
    return `${where}: under the fog, so the server names nothing`;
  }
  if (answer.river === null) {
    return `${where}: no river there`;
  }
  const { name, also, of1790 } = answer.river;
  if (name === undefined) {
    return `${where}: a river nobody has named`;
  }
  return `${where}: the ${name}${also === undefined ? '' : of1790 ? ` (${also} today)` : ` (${also})`}`;
}

import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';
import type { InspectedFrame, WaterKind, WaterView } from '@villages/protocol';

/**
 * The waters the server has named for this page's clicks - rivers, lakes and seas - by the id their inspect windows
 * are opened under: what a window on water says. The server's answers and nothing else, because a player learns a
 * name from the server and never from the page's own copy of the names (0087). Nothing here survives a reload.
 */

/** Water the server named for a click, and where the click was. */
export interface WaterSeen {
  readonly id: string;
  readonly water: WaterView;
  readonly at: { readonly lat: number; readonly lon: number };
}

const store = createStore<{ seen: ReadonlyMap<string, WaterSeen> }>({ seen: new Map() });

export const watersStore: Readable<{ seen: ReadonlyMap<string, WaterSeen> }> = store;

/**
 * Takes an answer in: the water it names, kept under its real identity so that two clicks on the Vistula are one
 * window, or under the place for water nobody has named; or null where the answer names none.
 */
export function heardWater(answer: InspectedFrame): WaterSeen | null {
  if (answer.water === null) {
    return null;
  }
  const id = answer.water.id ?? `at:${answer.at.lat.toFixed(3)},${answer.at.lon.toFixed(3)}`;
  const seen: WaterSeen = { id, water: answer.water, at: answer.at };
  store.set({ seen: new Map(store.get().seen).set(id, seen) });
  return seen;
}

/**
 * A water's name as English says it inside a sentence: the Vistula, the German Ocean, the Lake of Geneva, but Lake
 * Maeler and Loch Ness, which take no article.
 */
export function called(kind: WaterKind, name: string): string {
  if (name.startsWith('The ')) {
    return `the ${name.slice('The '.length)}`;
  }
  return kind === 'lake' && /^(Lake|Loch|Lough) (?!of )/.test(name) ? name : `the ${name}`;
}

/** What the log says of an answer, for the debug panel: the water by kind and name, or why there is none. */
export function sayAnswer(answer: InspectedFrame): string {
  const { lat, lon } = answer.at;
  const where = `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;
  if (!answer.revealed) {
    return `${where}: under the fog, so the server names nothing`;
  }
  if (answer.water === null) {
    return `${where}: no water there`;
  }
  const { kind, name, also, of1790 } = answer.water;
  if (name === undefined) {
    return `${where}: a ${kind} nobody has named`;
  }
  return `${where}: ${kind}, ${called(kind, name)}${also === undefined ? '' : of1790 ? ` (${also} today)` : ` (${also})`}`;
}

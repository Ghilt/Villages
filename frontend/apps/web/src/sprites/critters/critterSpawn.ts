import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';

import type { SpawnAsk } from './types';

/**
 * A critter put where Adam clicks, to look at one without waiting for the clock to bring it: the Critters part's
 * buttons arm a kind, and while one is armed every click on the map asks for one of that kind there, now. It is this
 * window's own, neither remembered nor sent, outside the shared world: what comes is what the world would bring there
 * - a flock out of the nearest tree, a squirrel or a hare from the nearest cover to the next, a fish out of the water -
 * only sooner, wherever the click, seen or not. The layer makes each one up from the ground there
 * (`spawned.ts`). Escape, or the armed button again, stops.
 */

/** The kinds a button puts on the map, in the order of their buttons. */
export const SPAWNABLE = ['songbird', 'squirrel', 'hare', 'fish', 'hawk'] as const;
export type Spawnable = (typeof SPAWNABLE)[number];

interface SpawnState {
  armed: Spawnable | null;
  asked: readonly SpawnAsk[];
}

const spawn = createStore<SpawnState>({ armed: null, asked: [] });

export const critterSpawnStore: Readable<SpawnState> = spawn;

/** Arms a kind, so the next clicks on the map put one there, or stops with null. */
export function armSpawn(kind: Spawnable | null): void {
  if (spawn.get().armed === kind) return;
  note(
    'critters',
    kind === null ? 'no longer putting critters' : `armed: click on the map to put a ${kind} there`,
  );
  spawn.set({ ...spawn.get(), armed: kind });
}

let asks = 0;

/** A click on the map while a kind is armed: one of it there, now. */
export function askSpawn(x: number, y: number): void {
  const kind = spawn.get().armed;
  if (kind === null) return;
  asks += 1;
  spawn.set({
    ...spawn.get(),
    asked: [...spawn.get().asked, { id: asks, kind, x, y, at: Date.now() / 1000 }],
  });
}

/** Every click asked for and not yet taken, taken: the layer's, which makes each one up when the ground is known. */
export function takeSpawns(): readonly SpawnAsk[] {
  const asked = spawn.get().asked;
  if (asked.length > 0) spawn.set({ ...spawn.get(), asked: [] });
  return asked;
}

import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { fenceSize, fenceWindow } from '@villages/world';
import type { Fence } from '@villages/world';

import { note } from '../log/log';
import { forgetSubject } from '../inspect/subjects';
import { censusOf } from './census';
import type { Census } from './census';

/**
 * The areas drawn on the map.
 *
 * Which one is being looked at is not here any more: an area is a **subject**, and what is being inspected
 * is one store for every kind of thing (`inspect/subjects.ts`). This used to keep a selection of its own
 * beside the houses' one, which is exactly the split that made two clicks mean two different things.
 *
 * A store, the one shape every piece of state the page watches takes, read in a component through
 * `useStore`, which keeps the state out of the component tree.
 *
 * Local to the browser, deliberately. An area is not an event yet: nothing here reaches the gateway, and
 * a reload forgets them. When areas become something the world remembers, this becomes a reducer over
 * frames in the client core and the fence becomes what an event carries; the shape of an area does not
 * have to change for that.
 *
 * The fence is the only thing kept. The census is derived from it and may be asked for again at any time,
 * which is why `recount` exists and why nothing here caches a number the fence could answer for itself.
 */

export interface Area {
  id: string;
  fence: Fence;
  /** Whether the inside is shaded as well as fenced. */
  shaded: boolean;
  /** Diamonds enclosed, which the fence knows on its own, before any terrain is read. */
  diamonds: number;
  census: Census | null;
  counting: boolean;
  /** Why the census could not be taken, if it could not. */
  problem: string | null;
}

export interface AreasState {
  readonly areas: readonly Area[];
  /** Whether the next drag on the map paints an area rather than moving the camera. */
  readonly armed: boolean;
}

const NO_AREAS: AreasState = { areas: [], armed: false };

const store = createStore<AreasState>(NO_AREAS);

/** The areas, and whether the next drag draws one. */
export const areasStore: Readable<AreasState> = store;

function update(change: Partial<AreasState>): void {
  store.set(change);
}

/** One array per change, so React can tell whether anything happened. */
/** Replaces one area, if it is still there. A census that comes back late must not raise the dead. */
function replace(id: string, change: Partial<Area>): void {
  if (!store.get().areas.some((area) => area.id === id)) {
    return;
  }
  update({ areas: store.get().areas.map((area) => (area.id === id ? { ...area, ...change } : area)) });
}

export function armDrawing(armed: boolean): void {
  if (store.get().armed === armed) {
    return;
  }
  note('area', armed ? 'armed: drag on the map to paint an area' : 'no longer drawing');
  update({ armed });
}

let minted = 0;

/** Takes a fence, selects it, and starts counting what it holds. */
export function addArea(fence: Fence, tilesRoot: string): string {
  minted += 1;
  const id = `a-${Date.now().toString(36)}-${minted}`;
  const window = fenceWindow(fence);
  const diamonds = fenceSize(fence);
  const vertices = fence.parts.reduce(
    (sum, part) => sum + part.outer.length + part.holes.reduce((held, hole) => held + hole.length, 0),
    0,
  );

  note(
    'area',
    `${id}: ${fence.parts.length} part(s), ${vertices} vertices over ${window.width} by ` +
      `${window.height} diamonds turned ${fence.grid.turn} degrees, ${diamonds.toLocaleString()} enclosed`,
  );

  update({
    areas: [
      ...store.get().areas,
      { id, fence, shaded: true, diamonds, census: null, counting: false, problem: null },
    ],
  });
  countArea(id, tilesRoot);
  return id;
}

/** Reads the terrain under an area again. The fence is the truth, so this may be asked at any time. */
export function countArea(id: string, tilesRoot: string): void {
  const area = store.get().areas.find((candidate) => candidate.id === id);
  if (area === undefined || area.counting) {
    return;
  }
  replace(id, { counting: true, problem: null });

  void censusOf(area.fence, tilesRoot).then(
    (census) => {
      replace(id, { census, counting: false });
      note(
        'area',
        `${id}: ${census.diamonds.toLocaleString()} diamonds of ${census.byClass.size} kinds from ` +
          `${census.tiles} tiles in ${census.tookMs} ms` +
          (census.unknown > 0 ? `, ${census.unknown} with no tile to read` : ''),
      );
    },
    (cause: unknown) => {
      const problem = cause instanceof Error ? cause.message : String(cause);
      replace(id, { counting: false, problem });
      note('area', `${id}: could not be counted, ${problem}`);
    },
  );
}

export function shadeArea(id: string, shaded: boolean): void {
  replace(id, { shaded });
}

export function deleteArea(id: string): void {
  if (!store.get().areas.some((area) => area.id === id)) {
    return;
  }
  note('area', `${id} deleted`);
  update({ areas: store.get().areas.filter((area) => area.id !== id) });
  // A window open on it is now a window about nothing, and the player did not close it.
  forgetSubject({ kind: 'area', id });
}

export function forgetAreas(): void {
  if (store.get().areas.length === 0) {
    return;
  }
  const had = store.get().areas;
  note('area', `${had.length} deleted`);
  update({ areas: [] });
  for (const area of had) {
    forgetSubject({ kind: 'area', id: area.id });
  }
}

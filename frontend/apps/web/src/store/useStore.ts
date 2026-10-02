import { useSyncExternalStore } from 'react';

import type { Readable } from '@villages/client-core';

/**
 * Reads a store in a component: the part of it `select` picks, drawn again only when that part changes.
 *
 * Every piece of state the page watches is the one shape, a `Readable`: the client core's `createStore`, handed
 * out read-only by the module that owns it, which changes it only through functions of its own that say why. A
 * component reads one through this and nothing else, and picks what it uses, so that a frame which changed
 * something else does not draw it again.
 *
 * What `select` returns must be the same thing each time it is asked of the same state: a number, a string, or
 * something already in the state. A new object - a list filtered, a view worked out - would look like a change to
 * React every time it asked, so those are worked out in the component from what was picked.
 */
export function useStore<S extends object>(store: Readable<S>): S;
export function useStore<S extends object, T>(store: Readable<S>, select: (state: S) => T): T;
export function useStore<S extends object, T>(store: Readable<S>, select?: (state: S) => T): S | T {
  const picked: () => S | T = select === undefined ? store.get : () => select(store.get());
  // The same answer for a page drawn ahead of time, which is how the test reads it.
  return useSyncExternalStore(store.watch, picked, picked);
}

import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

/**
 * The key figure the pane has open, by id, or null while it shows them all: mirrored out of the pane so that a
 * choice roll can say who the player is looking at. The pane holds the state; this only says it. See 0083.
 */
const store = createStore<{ readonly id: string | null }>({ id: null });

export const focusedFigureStore: Readable<{ readonly id: string | null }> = store;

export function focusFigure(id: string | null): void {
  if (store.get().id !== id) store.set({ id });
}

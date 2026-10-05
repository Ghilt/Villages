import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

/**
 * The dialogue the pane has open to be read, by id, or null while it lists them: mirrored out of the pane so that
 * a choice roll can say which dialogue the player is in. The pane holds the state; this only says it. See 0083.
 */
const store = createStore<{ readonly id: string | null }>({ id: null });

export const openDialogueStore: Readable<{ readonly id: string | null }> = store;

export function openDialogue(id: string | null): void {
  if (store.get().id !== id) store.set({ id });
}

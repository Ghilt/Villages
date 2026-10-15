import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

/**
 * The quest the pane is asked to open, by id, until it has: what a quest arriving asks, so the pane opens on the
 * quest's map rather than the list, whether it was standing already or is made in the same moment. The pane holds
 * which quest is open; this only asks. See decision record 0096.
 */
const store = createStore<{ readonly id: string | null }>({ id: null });

export const questToOpenStore: Readable<{ readonly id: string | null }> = store;

/** Ask the pane to open this quest. */
export function openQuest(id: string): void {
  store.set({ id });
}

/** The pane has opened it, or chosen otherwise, and the asking is done. */
export function questOpened(): void {
  if (store.get().id !== null) store.set({ id: null });
}

import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

/**
 * The conversation the dialogues pane is asked to open, by id, until it has: what pressing a quest's dialogue node
 * asks, so the conversation is what the player meets on the dialogues' tab. The pane holds which is open; this only
 * asks. See decision record 0096.
 */
const store = createStore<{ readonly id: string | null }>({ id: null });

export const conversationToOpenStore: Readable<{ readonly id: string | null }> = store;

/** Ask the pane to open this conversation. */
export function openConversation(id: string): void {
  store.set({ id });
}

/** The pane has opened it, and the asking is done. */
export function conversationOpened(): void {
  if (store.get().id !== null) store.set({ id: null });
}

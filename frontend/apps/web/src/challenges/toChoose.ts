import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

/** The challenge node a quest stands at that the pane is asked to choose slices for: its quest and its node. */
export interface ChallengeAsked {
  readonly questId: string;
  readonly nodeId: string;
}

/**
 * The challenge the pane is asked to open its choosing on, until it has: what pressing a quest's challenge node asks.
 * Nothing about the challenge is kept here or anywhere else before it is accepted, so leaving the choosing leaves
 * nothing behind; this only asks. See decision record 0107, amended.
 */
const store = createStore<{ readonly asked: ChallengeAsked | null }>({ asked: null });

export const challengeAskedStore: Readable<{ readonly asked: ChallengeAsked | null }> = store;

/** Ask the pane to choose for the challenge this quest's node puts. */
export function chooseFor(asked: ChallengeAsked): void {
  store.set({ asked });
}

/** The pane has opened it, and the asking is done. */
export function chosenFor(): void {
  if (store.get().asked !== null) store.set({ asked: null });
}

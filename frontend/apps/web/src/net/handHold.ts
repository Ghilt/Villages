import { createStore } from '@villages/client-core';
import type { Readable, SessionState } from '@villages/client-core';

/**
 * A hand held back while the die its roll was thrown with is still in the air. The roll is sent as the die is let go,
 * from where the throw will leave it, so its answer comes back while the die still flies; everything the page draws
 * goes on seeing the session as it was before the roll until the die has come to rest and been seen there, so the
 * hand does not open over the throw. Only the die is told the hand at once, to paint the rarity it drew on its top
 * face. See decision record 0118.
 */

const hold = createStore<{ held: boolean }>({ held: false });
/** The hand standing when the hold began, which is what the page goes on seeing until it ends: none, as a rule. */
let before: SessionState['yourChoice'] = null;

/** The die was let go and its roll sent, `standing` being the hand there was then: the hand that answers it waits. */
export function holdTheHand(standing: SessionState['yourChoice']): void {
  before = standing;
  hold.set({ held: true });
}

/** The die rests and has been seen resting, or its roll was refused: the hand, if one came, is shown. */
export function showTheHand(): void {
  hold.set({ held: false });
}

/** The session as the page shows it, from the session as it is: the same, but for a hand held back. */
export function heldBack(session: Readable<SessionState>): Readable<SessionState> {
  // The same object for the same state and hold, as `useSyncExternalStore` asks of anything it reads.
  let made: { from: SessionState; shown: SessionState } | null = null;
  return {
    get: () => {
      const state = session.get();
      if (!hold.get().held || state.yourChoice === before) return state;
      if (made?.from !== state) made = { from: state, shown: { ...state, yourChoice: before } };
      return made.shown;
    },
    watch: (listener) => {
      const unwatched = [session.watch(listener), hold.watch(listener)];
      return () => unwatched.forEach((unwatch) => unwatch());
    },
  };
}

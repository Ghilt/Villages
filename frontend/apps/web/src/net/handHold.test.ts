import { describe, expect, it } from 'vitest';

import { createStore } from '@villages/client-core';
import type { SessionState } from '@villages/client-core';

import { heldBack, holdTheHand, showTheHand } from './handHold';

const HAND = { id: 'a hand' } as unknown as SessionState['yourChoice'];

describe('a hand held back while its die is in the air', () => {
  it('is not in the session the page sees until it is shown, and is the same object while nothing changes', () => {
    const session = createStore({ yourChoice: null } as unknown as SessionState);
    const shown = heldBack(session);
    let told = 0;
    const unwatch = shown.watch(() => (told += 1));

    holdTheHand(null);
    session.set({ yourChoice: HAND });
    expect(shown.get().yourChoice).toBeNull();
    expect(shown.get()).toBe(shown.get());

    showTheHand();
    expect(shown.get().yourChoice).toBe(HAND);
    expect(told).toBe(3);
    unwatch();
  });

  it('leaves the session as it is while nothing is held', () => {
    const session = createStore({ yourChoice: HAND } as unknown as SessionState);
    expect(heldBack(session).get()).toBe(session.get());
  });
});

import { describe, expect, it } from 'vitest';

import { PLAYER_TOKEN_KEY, forgetOldPlayerToken, oldPlayerToken } from './identity';
import type { TokenStore } from './identity';

function fakeStore(initial: Record<string, string> = {}): TokenStore & { contents: Record<string, string> } {
  const contents: Record<string, string> = { ...initial };
  return {
    contents,
    get: (key) => contents[key] ?? null,
    remove: (key) => {
      delete contents[key];
    },
  };
}

describe('the player a browser kept before there were sign-ins', () => {
  it('is read as it was kept, and kept until it is forgotten', () => {
    const store = fakeStore({ [PLAYER_TOKEN_KEY]: 'the-old-player' });

    expect(oldPlayerToken(store)).toBe('the-old-player');
    expect(oldPlayerToken(store)).toBe('the-old-player');
    forgetOldPlayerToken(store);
    expect(oldPlayerToken(store)).toBeNull();
    expect(store.contents[PLAYER_TOKEN_KEY]).toBeUndefined();
  });

  it('is nobody when the browser kept none, or kept a blank one', () => {
    expect(oldPlayerToken(fakeStore())).toBeNull();
    expect(oldPlayerToken(fakeStore({ [PLAYER_TOKEN_KEY]: '   ' }))).toBeNull();
  });
});

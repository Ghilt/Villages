import { describe, expect, it } from 'vitest';

import { PLAYER_TOKEN_KEY, ensurePlayerToken } from './identity';
import type { TokenStore } from './identity';

function fakeStore(initial: Record<string, string> = {}): TokenStore & { contents: Record<string, string> } {
  const contents: Record<string, string> = { ...initial };
  return {
    contents,
    get: (key) => contents[key] ?? null,
    set: (key, value) => {
      contents[key] = value;
    },
  };
}

describe('the player token', () => {
  it('is created and kept when the store is empty', () => {
    const store = fakeStore();

    const token = ensurePlayerToken(store, () => 'first-token');

    expect(token).toBe('first-token');
    expect(store.contents[PLAYER_TOKEN_KEY]).toBe('first-token');
  });

  it('is reused on a later visit, so the same browser keeps the same house', () => {
    const store = fakeStore({ [PLAYER_TOKEN_KEY]: 'kept-token' });

    const token = ensurePlayerToken(store, () => {
      throw new Error('a new token must not be generated when one is already stored');
    });

    expect(token).toBe('kept-token');
  });

  it('replaces a blank stored value rather than handing it out', () => {
    const store = fakeStore({ [PLAYER_TOKEN_KEY]: '   ' });

    const token = ensurePlayerToken(store, () => 'replacement');

    expect(token).toBe('replacement');
    expect(store.contents[PLAYER_TOKEN_KEY]).toBe('replacement');
  });
});

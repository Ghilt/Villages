/** Where a player token is kept between visits. Implemented over local storage by the browser. */
export interface TokenStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const PLAYER_TOKEN_KEY = 'villages.playerToken';

/**
 * A player is anonymous until accounts exist: the browser keeps a token and sends it on the handshake.
 * The token generator is injected because this package has no access to the platform. See docs/adr/0008.
 */
export function ensurePlayerToken(store: TokenStore, newToken: () => string): string {
  const existing = store.get(PLAYER_TOKEN_KEY);
  if (existing !== null && existing.trim() !== '') {
    return existing;
  }
  const token = newToken();
  store.set(PLAYER_TOKEN_KEY, token);
  return token;
}

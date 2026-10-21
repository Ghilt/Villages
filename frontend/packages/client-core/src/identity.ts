/** Where a browser kept who it played as, before there were sign-ins. Implemented over local storage by the browser. */
export interface TokenStore {
  get(key: string): string | null;
  remove(key: string): void;
}

/** The key a browser kept its player under before there were sign-ins. */
export const PLAYER_TOKEN_KEY = 'villages.playerToken';

/**
 * The player this browser played as before there were sign-ins, or null when it kept none, or a blank one. The page
 * hands it to the server once, to be made a guest of that same player, which keeps the house it founded, and then
 * forgets it. Who a browser plays as is its sign-in now, a cookie the page cannot read, so nothing is written here
 * again. See decision record 0109.
 */
export function oldPlayerToken(store: TokenStore): string | null {
  const kept = store.get(PLAYER_TOKEN_KEY);
  return kept === null || kept.trim() === '' ? null : kept;
}

/** Forgets the player this browser kept before there were sign-ins, once the server has had it. */
export function forgetOldPlayerToken(store: TokenStore): void {
  store.remove(PLAYER_TOKEN_KEY);
}

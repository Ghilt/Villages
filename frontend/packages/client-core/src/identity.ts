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

/**
 * Forgets who this browser was playing as, so that the next `ensurePlayerToken` makes a new one.
 *
 * Starting over is a debug affordance and not a player's: trying the opening means arriving new many
 * times an hour. The house the old player founded stays in the world, because nothing is ever deleted.
 * See decision record 0036.
 *
 * Blanking rather than removing, because `TokenStore` has no remove and does not need one: a blank
 * value already means absent to the function above.
 */
export function forgetPlayerToken(store: TokenStore): void {
  store.set(PLAYER_TOKEN_KEY, '');
}

/**
 * Makes this browser play as the player of [token] from its next hello: a token is all a player is until accounts
 * exist (0008), so a debug panel that knows another player's knows enough to be them. What a load does, so the
 * browser that loaded a save arrives as the player who made it, and what switching players does. See 0101.
 */
export function becomePlayer(store: TokenStore, token: string): void {
  store.set(PLAYER_TOKEN_KEY, token);
}

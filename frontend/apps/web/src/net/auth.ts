import { createStore, forgetOldPlayerToken, oldPlayerToken } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note, shortId } from '../log/log';

/**
 * Who this browser is, as the game server's `/auth/me` answers it: a player, their house and the sign-in that makes
 * the browser them, or nobody. Times are milliseconds. See decision record 0109.
 */
export interface Me {
  player: string | null;
  house: string | null;
  guest: boolean;
  signIn: SignInView | null;
}

/** A sign-in, as the server says it: how it is kept, the browser as a person would name it, and when it ends. */
export interface SignInView {
  id: string;
  keeping: 'guest' | 'remembered' | 'forNow';
  browser: string;
  ends: number;
}

const NOBODY: Me = { player: null, house: null, guest: false, signIn: null };

const known = createStore<{ me: Me | null }>({ me: null });

/** Who this browser is, once the page has asked: null until then. */
export const meStore: Readable<{ me: Me | null }> = known;

/** Where this browser kept its player before there were sign-ins. */
const kept = {
  get: (key: string) => localStorage.getItem(key),
  remove: (key: string) => localStorage.removeItem(key),
};

/**
 * Asks the game server something under `/auth`, which the dev server passes through to this tree's game server, so
 * the page talks to its own address and the sign-in's cookie is the page's own. What a refusal says is thrown.
 */
async function ask(method: 'GET' | 'POST', path: string, body?: object): Promise<Me> {
  const response = await fetch(`/auth/${path}`, {
    method,
    credentials: 'same-origin',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const refused = (await response.json().catch(() => ({}))) as { refused?: string };
    throw new Error(refused.refused ?? `/auth/${path} answered ${response.status}`);
  }
  return (await response.json()) as Me;
}

let signingIn: Promise<Me> | null = null;

/**
 * Signs this browser in, once a page, before its socket opens, since the socket's handshake is what carries the
 * sign-in to the game: asks who it is, and makes a newcomer a guest, of the same player it kept in local storage
 * before there were sign-ins when it kept one, so the house it founded is still its own. Never throws: a server
 * that does not answer leaves the page nobody, and the socket says the rest.
 */
export function signIn(): Promise<Me> {
  signingIn ??= (async () => {
    try {
      const me = await ask('GET', 'me');
      if (me.player !== null) {
        known.set({ me });
        return me;
      }
      const old = oldPlayerToken(kept);
      const made = await ask('POST', 'guest', old === null ? {} : { adopt: old });
      forgetOldPlayerToken(kept);
      note(
        'player',
        old !== null && made.player === old
          ? `the player this browser kept before sign-ins, ${shortId(old)}, is its guest now, house and all`
          : `a newcomer, made a guest, player ${shortId(made.player ?? '')}`,
      );
      known.set({ me: made });
      return made;
    } catch (unanswered) {
      note(
        'player',
        `could not sign in: ${unanswered instanceof Error ? unanswered.message : String(unanswered)}`,
      );
      known.set({ me: NOBODY });
      return NOBODY;
    }
  })();
  return signingIn;
}

/**
 * Starts over as somebody new: this browser's sign-in ended and a newcomer's begun, ready for a reload. The house
 * the old player founded stays in the world as somebody's. A debug affordance, not a player's; see 0036.
 */
export async function startOver(): Promise<void> {
  await ask('POST', 'guest', {});
}

/**
 * Adam's instrument: this browser signed in as another player of this world, ready for a reload, which is how the
 * debug panel switches player and arrives as the maker of a save it loaded. Refused while the instruments are
 * closed. See decision record 0101.
 */
export async function becomePlayer(player: string): Promise<void> {
  await ask('POST', 'become', { player });
}

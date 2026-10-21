import { createStore, forgetOldPlayerToken, oldPlayerToken } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note, shortId } from '../log/log';
import { moveAs } from '../motion/motion';
import type { Motion } from '../motion/motion';

/**
 * Who this browser is, as the game server's `/auth/me` answers it: a player, their house and the sign-in that makes
 * the browser them, or nobody. Times are milliseconds. See decision record 0109.
 */
export interface Me {
  player: string | null;
  house: string | null;
  guest: boolean;
  /** The account's email, or null for a guest. */
  email: string | null;
  verified: boolean;
  signIn: SignInView | null;
  settings: Settings;
}

/** A player's settings that are not the game's, kept for them by the server. */
export interface Settings {
  motion: Motion;
  language: 'en';
}

/** A sign-in, as the server says it: how it is kept, the browser as a person would name it, and when it ends. */
export interface SignInView {
  id: string;
  keeping: 'guest' | 'remembered' | 'forNow';
  browser: string;
  ends: number;
}

const NOBODY: Me = {
  player: null,
  house: null,
  guest: false,
  email: null,
  verified: false,
  signIn: null,
  settings: { motion: 'device', language: 'en' },
};

const known = createStore<{ me: Me | null }>({ me: null });

/** Who this browser is now, and the world moving as their settings say. */
function knownAs(me: Me): void {
  moveAs(me.settings.motion);
  known.set({ me });
}

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
async function ask<T = Me>(method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
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
  return (await response.json()) as T;
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
        knownAs(me);
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
      knownAs(made);
      return made;
    } catch (unanswered) {
      note(
        'player',
        `could not sign in: ${unanswered instanceof Error ? unanswered.message : String(unanswered)}`,
      );
      knownAs(NOBODY);
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

/** Asks again who this browser is, for the debug panel: what the page knew at its load may have ended since. */
export async function whoAmI(): Promise<Me> {
  const me = await ask('GET', 'me');
  knownAs(me);
  return me;
}

/**
 * This player's settings, written whole and kept for them by the server, so they follow an account to another
 * browser; the world moves as they say from the next frame. What the server refuses is thrown.
 */
export async function settle(settings: Settings): Promise<Me> {
  const me = await ask('POST', 'settings', settings);
  knownAs(me);
  return me;
}

/**
 * An account made with [email] and [password], and this browser signed in to it, remembered unless [remember] is
 * false: a guest's own player becomes it, house and all. An email with an account already is mailed to say so, and
 * the answer is who the browser was before - its `email` still not the one asked for. What the server refuses, a
 * password that will not do among it, is thrown as its code.
 */
export function makeAccount(email: string, password: string, remember: boolean): Promise<Me> {
  return ask('POST', 'signup', { email, password, remember });
}

/** This browser signed in to the account [email] is kept under, if [password] is its; refused as its code. */
export function signInWith(email: string, password: string, remember: boolean): Promise<Me> {
  return ask('POST', 'signin', { email, password, remember });
}

/** The email a mailed link's [secret] verifies, verified; refused as `linkUsedOrOld` when it has been used or has ended. */
export async function verifyEmail(secret: string): Promise<void> {
  await ask('POST', 'verify', { secret });
}

/** The link that verifies this browser's account's email mailed again; only the newest works. */
export async function mailVerifyingAgain(): Promise<void> {
  await ask('POST', 'verify/again');
}

/** A link to choose a new password mailed to the account of [email], if it has one: the answer is the same either way. */
export async function forgotPassword(email: string): Promise<void> {
  await ask('POST', 'forgot', { email });
}

/**
 * A new password chosen through a mailed link's [secret]: every browser signed in to the account signed out, and this
 * one signed in to it, remembered unless [remember] is false. Refused as its code.
 */
export function resetPassword(secret: string, password: string, remember: boolean): Promise<Me> {
  return ask('POST', 'reset', { secret, password, remember });
}

/** This account's password changed from [was]: every other browser signed out of it. Refused as its code. */
export function changePassword(was: string, password: string): Promise<Me> {
  return ask('POST', 'password', { was, password });
}

/** This browser signed out: its sign-in ended on the server, and its windows stood down. */
export async function signOut(): Promise<void> {
  await ask('POST', 'signout');
}

/**
 * Adam's lever, standing in for time: this browser's sign-in ends now, as one left unused past its time does, and the
 * game server stands its windows down. Refused while the instruments are closed.
 */
export async function runOut(): Promise<void> {
  await ask('POST', 'runout');
}

/** A mail the game server sent, as its outbox has it. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  link: string | null;
  sent: number;
}

/** Every mail the game server sent, the newest last: Adam's instrument, since the mail holds live links. */
export function outbox(): Promise<Mail[]> {
  return ask<Mail[]>('GET', 'outbox');
}

/**
 * Adam's instrument: this browser signed in as another player of this world, ready for a reload, which is how the
 * debug panel switches player and arrives as the maker of a save it loaded. Refused while the instruments are
 * closed. See decision record 0101.
 */
export async function becomePlayer(player: string): Promise<void> {
  await ask('POST', 'become', { player });
}

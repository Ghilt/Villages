import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';
import type { Rarity } from '@villages/protocol';

import type { Along } from '../stage/panes';

/**
 * Whether this page pressed Take action and is waiting on the hand it rolled: the hand that answers it is played,
 * the report card filling and the stamp landing, and any other - one already pending at a reload, one the world
 * gave - is drawn as it ends. A module of its own because the button that sets it is gone by the time the hand
 * arrives. See decision record 0083.
 */
let awaiting = false;

/** Take action was pressed: the next rolled hand to arrive is this page's to play. */
export function expectHand(): void {
  awaiting = true;
}

/** Whether a hand arriving now was asked for here, which answers it: only the first hand after a press plays. */
export function handExpected(): boolean {
  const was = awaiting;
  awaiting = false;
  return was;
}

/**
 * The number on top of a die thrown for a roll that drew `rarity`: 6 legendary, 5 rare, 3 or 4 uncommon and 1 or 2
 * common, the one or the other by `chance`, a number from nought to one. Adam's word of 2026-10-24.
 */
export function numberOf(rarity: Rarity, chance: number = Math.random()): number {
  switch (rarity) {
    case 'legendary':
      return 6;
    case 'rare':
      return 5;
    case 'uncommon':
      return chance < 0.5 ? 3 : 4;
    case 'common':
      return chance < 0.5 ? 1 : 2;
  }
}

/**
 * What a die thrown for a roll that drew `rarity` glows in once it rests, its rarity's colour as `read` reads a token
 * off the page: none for a common roll, drab on Adam's word of 2026-10-24.
 */
export function glowOf(
  rarity: Rarity,
  read: (token: string) => string = (token) =>
    getComputedStyle(document.documentElement).getPropertyValue(token),
): string | null {
  if (rarity === 'common') return null;
  const colour = read(`--ui-rarity-${rarity}`).trim();
  return colour === '' ? null : colour;
}

/** A bolt from a die at rest to the hand its roll drew: from where it lies, in the window's pixels, in a colour. */
export interface RollStrike {
  readonly key: string;
  readonly from: { readonly x: number; readonly y: number };
  readonly colour: string;
}

const striking = createStore<{ strike: RollStrike | null }>({ strike: null });

/** The latest bolt, for the lightning laid over the stage, `RollLightning`. */
export const rollStrike: Readable<{ strike: RollStrike | null }> = striking;

/** A die at rest strikes the hand its roll drew. */
export function strikeTheHand(strike: RollStrike): void {
  striking.set({ strike });
}

/**
 * The class the letter takes opened out on a desktop, lying over everything: what it says fades in once its box
 * has grown there, the cards' details a beat after their titles. See `choice.css` and decision record 0086.
 */
export function overOf(along: Along): string {
  return along === null ? ' choice--over' : '';
}

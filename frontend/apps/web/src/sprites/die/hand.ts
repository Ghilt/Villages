import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

/**
 * The game's die, as the choice roll's pane holds it: a few verbs, which the die layer on the sprite canvas answers
 * once it has been fetched, after the game has started. Until then there is none, and the podium cannot be lifted.
 * Registered here by the layer rather than handed down, as the map's `focusOn` is, so the pane needs nothing of the
 * canvas. See `docs/plans/choice-roll-podium.md`, step 7.
 */

/** A place in the window's pixels, and when the hand was there, on the page's clock. */
export interface HandAt {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}

/** Where a die came to rest, on the Earth. */
export interface Landing {
  readonly lat: number;
  readonly lon: number;
}

export interface DieHand {
  /** A long press lifted the die here, by a finger or not, with the landing circle `circleKm` round its shadow. */
  pickUp(at: HandAt, byTouch: boolean, circleKm: number): void;
  /** The hand holding it went through these places. */
  move(path: readonly HandAt[]): void;
  /** It was let go here: it falls, bounces and comes to rest, and `rested` is told where. */
  letGo(at: HandAt, rested: (landing: Landing) => void): void;
  /** It goes back to its podium, from the hand or the map. */
  putBack(): void;
  /** Dropped at once at the middle of the view, with no hand: Enter on the podium. */
  dropAtCentre(circleKm: number, rested: (landing: Landing) => void): void;
  /**
   * Lying where a roll's die fell, its ring `circleKm` round it: as a page that reloads with a hand open draws it.
   * Nothing, when the die is already in the hand, in the air or lying.
   */
  lieAt(landing: Landing, circleKm: number): void;
}

const store = createStore<{ hand: DieHand | null }>({ hand: null });

/** The die, once the sprite canvas has fetched it, or null. */
export const dieStore: Readable<{ hand: DieHand | null }> = store;

/** The die layer saying it is here and can be held, or, gone, that it is not. */
export function holdTheDie(hand: DieHand | null): void {
  store.set({ hand });
}

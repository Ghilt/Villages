/**
 * How a roll plays, as arithmetic over the time since it began: the omens land in the report card one after
 * another, a beat, the options pop in one after another, and then it is settled. A press hurries the omens - every
 * one still to come lands at once. The rarity is said by the options themselves, their tag and their glow, and by
 * nothing in between. See `MECHANICS.md`, the choice roll, and decision record 0083.
 */

/** Between one omen landing and the next. */
export const ROW_MS = 320;

/** The beat between the last omen and the first option. */
export const BEAT_MS = 280;

/** Between one option popping in and the next. */
export const CARD_MS = 140;

/** How long the last option takes to settle before nothing more need be drawn. */
export const SETTLE_MS = 450;

export type Phase = 'rows' | 'cards' | 'settled';

export interface Play {
  readonly phase: Phase;
  /** How many omens have landed. */
  readonly landed: number;
  /** How many options are in. */
  readonly cardsIn: number;
}

/**
 * Where a roll of `rows` omens and `cards` options stands `elapsed` milliseconds in, hurried at `hurriedAt` or
 * not at all. A hurry after the omens have all landed changes nothing.
 */
export function playOf(elapsed: number, rows: number, cards: number, hurriedAt: number | null = null): Play {
  const rowsEnd = Math.min(rows * ROW_MS, hurriedAt ?? Infinity);
  const cardsStart = rowsEnd + BEAT_MS;
  if (elapsed < cardsStart) {
    const landed = elapsed < rowsEnd ? Math.min(rows, Math.floor(elapsed / ROW_MS)) : rows;
    return { phase: 'rows', landed, cardsIn: 0 };
  }
  if (elapsed < settledAt(rows, cards, hurriedAt)) {
    return {
      phase: 'cards',
      landed: rows,
      cardsIn: Math.min(cards, Math.floor((elapsed - cardsStart) / CARD_MS) + 1),
    };
  }
  return { phase: 'settled', landed: rows, cardsIn: cards };
}

/** When a roll of `rows` omens and `cards` options is settled, hurried or not: when nothing more need be drawn. */
export function settledAt(rows: number, cards: number, hurriedAt: number | null = null): number {
  return Math.min(rows * ROW_MS, hurriedAt ?? Infinity) + BEAT_MS + CARD_MS * cards + SETTLE_MS;
}

/** A finished roll, drawn as it ends: what a page reloaded mid-roll, or one that never saw it begin, shows. */
export const SETTLED: Play = { phase: 'settled', landed: Infinity, cardsIn: Infinity };

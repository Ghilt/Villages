import { describe, expect, it } from 'vitest';

import { BEAT_MS, CARD_MS, ROW_MS, SETTLE_MS, playOf, settledAt } from './timing';

describe('how a roll plays', () => {
  it('lands the omens one after another, a beat, then pops the options in, then settles', () => {
    expect(playOf(0, 5, 3)).toEqual({ phase: 'rows', landed: 0, cardsIn: 0 });
    expect(playOf(ROW_MS * 2 + 1, 5, 3)).toEqual({ phase: 'rows', landed: 2, cardsIn: 0 });
    expect(playOf(ROW_MS * 5, 5, 3)).toEqual({ phase: 'rows', landed: 5, cardsIn: 0 });
    expect(playOf(ROW_MS * 5 + BEAT_MS, 5, 3)).toEqual({ phase: 'cards', landed: 5, cardsIn: 1 });
    expect(playOf(ROW_MS * 5 + BEAT_MS + CARD_MS * 2, 5, 3).cardsIn).toBe(3);
    expect(playOf(settledAt(5, 3), 5, 3)).toEqual({ phase: 'settled', landed: 5, cardsIn: 3 });
  });

  it('lands every omen still to come at once when hurried', () => {
    const hurried = ROW_MS + 10;
    expect(playOf(hurried, 5, 3, hurried)).toEqual({ phase: 'rows', landed: 5, cardsIn: 0 });
    expect(playOf(hurried + BEAT_MS, 5, 3, hurried).phase).toBe('cards');
    expect(settledAt(5, 3, hurried)).toBe(hurried + BEAT_MS + CARD_MS * 3 + SETTLE_MS);
  });

  it('changes nothing when hurried after the omens have landed', () => {
    const late = ROW_MS * 5 + 100;
    expect(playOf(late, 5, 3, late)).toEqual(playOf(late, 5, 3));
  });

  it('goes straight to the beat for a roll that read nothing', () => {
    expect(playOf(0, 0, 3)).toEqual({ phase: 'rows', landed: 0, cardsIn: 0 });
    expect(playOf(BEAT_MS, 0, 3).phase).toBe('cards');
  });
});

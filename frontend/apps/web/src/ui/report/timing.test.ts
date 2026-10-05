import { describe, expect, it } from 'vitest';

import { CARD_MS, ROW_MS, SETTLE_MS, STAMP_MS, playOf, settledAt } from './timing';

describe('how a roll plays', () => {
  it('lands the omens one after another, then stamps, then pops the options in, then settles', () => {
    expect(playOf(0, 5, 3)).toEqual({ phase: 'rows', landed: 0, cardsIn: 0 });
    expect(playOf(ROW_MS * 2 + 1, 5, 3)).toEqual({ phase: 'rows', landed: 2, cardsIn: 0 });
    expect(playOf(ROW_MS * 5, 5, 3)).toEqual({ phase: 'stamp', landed: 5, cardsIn: 0 });
    expect(playOf(ROW_MS * 5 + STAMP_MS, 5, 3)).toEqual({ phase: 'cards', landed: 5, cardsIn: 1 });
    expect(playOf(ROW_MS * 5 + STAMP_MS + CARD_MS * 2, 5, 3).cardsIn).toBe(3);
    expect(playOf(settledAt(5, 3), 5, 3)).toEqual({ phase: 'settled', landed: 5, cardsIn: 3 });
  });

  it('lands every omen still to come at once when hurried, and still stamps for the whole of the stamp', () => {
    const hurried = ROW_MS + 10;
    expect(playOf(hurried, 5, 3, hurried)).toEqual({ phase: 'stamp', landed: 5, cardsIn: 0 });
    expect(playOf(hurried + STAMP_MS - 1, 5, 3, hurried).phase).toBe('stamp');
    expect(settledAt(5, 3, hurried)).toBe(hurried + STAMP_MS + CARD_MS * 3 + SETTLE_MS);
  });

  it('changes nothing when hurried after the omens have landed', () => {
    const late = ROW_MS * 5 + 100;
    expect(playOf(late, 5, 3, late)).toEqual(playOf(late, 5, 3));
  });

  it('goes straight to the stamp for a roll that read nothing', () => {
    expect(playOf(0, 0, 3).phase).toBe('stamp');
  });
});

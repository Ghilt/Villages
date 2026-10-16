import { describe, expect, it } from 'vitest';

import { sayCritters } from './CrittersSection';

describe("the Critters part's reading", () => {
  it('names what is flying, kind by kind', () => {
    expect(sayCritters({ flying: { songbird: 3 }, none: null })).toBe('3 songbirds');
    expect(sayCritters({ flying: { songbird: 1 }, none: null })).toBe('1 songbird');
    expect(sayCritters({ flying: {}, none: null })).toBe('none flying');
  });

  it('says why there are none when something keeps them away', () => {
    expect(sayCritters({ flying: {}, none: 'from zoom 9 in' })).toBe('from zoom 9 in');
  });
});

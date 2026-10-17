import { describe, expect, it } from 'vitest';

import { sayCritters } from './CrittersSection';

describe("the Critters part's reading", () => {
  it('names what is about, kind by kind', () => {
    expect(sayCritters({ about: { songbird: 3, hare: 1 }, none: null })).toBe('3 songbirds, 1 hare');
    expect(sayCritters({ about: { songbird: 1 }, none: null })).toBe('1 songbird');
    expect(sayCritters({ about: {}, none: null })).toBe('none about');
  });

  it('says why there are none when something keeps them away', () => {
    expect(sayCritters({ about: {}, none: 'from zoom 9 in' })).toBe('from zoom 9 in');
  });
});

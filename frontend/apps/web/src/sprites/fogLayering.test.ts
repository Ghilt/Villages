import { describe, expect, it } from 'vitest';

import { groundSideOf, overTheFog, standsAmongTheTrees } from './fogLayering';

describe('which side of the fog of war a thing is drawn on', () => {
  it('draws an icon over the fog wherever it stands, because an icon is a sign and not the world', () => {
    expect(overTheFog('icon', true)).toBe(true);
    expect(overTheFog('icon', false)).toBe(true);
  });

  it('draws a ground form over the fog in vision, and under it anywhere else', () => {
    expect(overTheFog('ground', true)).toBe(true);
    expect(overTheFog('ground', false)).toBe(false);
  });

  it("stands a structure's ground form among the trees, wherever it is, and nothing else's", () => {
    expect(standsAmongTheTrees('structure')).toBe(true);
    expect(standsAmongTheTrees('character')).toBe(false);
    expect(standsAmongTheTrees('candidate')).toBe(false);
    expect(groundSideOf('structure', true)).toBe('among');
    expect(groundSideOf('structure', false)).toBe('among');
    expect(groundSideOf('character', true)).toBe('over');
    expect(groundSideOf('character', false)).toBe('under');
  });
});

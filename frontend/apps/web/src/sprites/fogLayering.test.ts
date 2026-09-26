import { describe, expect, it } from 'vitest';

import { overTheFog } from './fogLayering';

describe('which side of the fog of war a thing is drawn on', () => {
  it('draws an icon over the fog wherever it stands, because an icon is a sign and not the world', () => {
    expect(overTheFog('icon', true)).toBe(true);
    expect(overTheFog('icon', false)).toBe(true);
  });

  it('draws a ground form over the fog in vision, and under it anywhere else', () => {
    expect(overTheFog('ground', true)).toBe(true);
    expect(overTheFog('ground', false)).toBe(false);
  });
});

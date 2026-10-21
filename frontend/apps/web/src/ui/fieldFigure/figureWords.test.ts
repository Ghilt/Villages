import { describe, expect, it } from 'vitest';

import { pullSaid } from './figureWords';

describe('what a figure pulled', () => {
  it('says its sign and its amount to a tenth', () => {
    expect(pullSaid(7.5)).toBe('+7.5');
    expect(pullSaid(-12)).toBe('−12');
    expect(pullSaid(3.04)).toBe('+3');
  });
});

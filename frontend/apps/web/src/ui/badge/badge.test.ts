import { describe, expect, it } from 'vitest';

import { countSaid } from './Badge';

describe('a badge', () => {
  it('says its count', () => {
    expect(countSaid(3)).toBe('3');
    expect(countSaid(99)).toBe('99');
  });

  it('says nothing at nought, rather than a pip the player learns to ignore', () => {
    expect(countSaid(0)).toBeNull();
    expect(countSaid(-2)).toBeNull();
    expect(countSaid(Number.NaN)).toBeNull();
  });

  it('says that many and more past its most, because four figures in a pip is a label', () => {
    expect(countSaid(100)).toBe('99+');
    expect(countSaid(12, 9)).toBe('9+');
  });
});

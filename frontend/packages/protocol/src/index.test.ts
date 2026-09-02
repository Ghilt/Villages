import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from './index';

describe('the protocol', () => {
  it('declares a whole, positive version', () => {
    expect(PROTOCOL_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
  });
});

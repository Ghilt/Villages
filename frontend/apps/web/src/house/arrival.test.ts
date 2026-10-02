import { describe, expect, it } from 'vitest';

import { arrived } from './arrival';

describe('the house arriving', () => {
  it('is a house the page has not been shown before', () => {
    expect(arrived(new Set(), { id: 'fenwold' })).toBe(true);
  });

  // The house is sent again whenever anything in it changes - a purse paid in a dialogue - and as a new
  // object every time, which is what a flight keyed on the house as it was sent could not tell apart.
  it('is not the same house sent again', () => {
    const seen = new Set<string>();
    arrived(seen, { id: 'fenwold' });

    expect(arrived(seen, { id: 'fenwold' })).toBe(false);
  });

  it('is nothing before there is a house, and the house once there is one', () => {
    const seen = new Set<string>();

    expect(arrived(seen, null)).toBe(false);
    expect(arrived(seen, { id: 'fenwold' })).toBe(true);
  });

  // A page that lost the house for a moment - a reconnect - has still been shown it.
  it('is not the same house come back', () => {
    const seen = new Set<string>();
    arrived(seen, { id: 'fenwold' });
    arrived(seen, null);

    expect(arrived(seen, { id: 'fenwold' })).toBe(false);
  });
});

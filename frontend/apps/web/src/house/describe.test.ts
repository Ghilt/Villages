import { describe, expect, it } from 'vitest';

import type { Stock } from '@villages/protocol';

import { RESOURCES_IN_ORDER, RESOURCE_WORDS, saysStock } from './describe';

const noon = 1_788_609_600_000;

function stock(over: Partial<Stock> = {}): Stock {
  return { total: 100, pledged: 0, ratePerSecond: 0, asOf: noon, ...over };
}

describe('the words a player is shown', () => {
  it('shows Domain for the resource the code calls naturalDomain', () => {
    expect(RESOURCE_WORDS.naturalDomain).toBe('Domain');
  });

  it('has a word for every resource on the wire, and shows the row in a fixed order', () => {
    expect([...RESOURCES_IN_ORDER].sort()).toEqual(Object.keys(RESOURCE_WORDS).sort());
    expect(RESOURCES_IN_ORDER).toHaveLength(5);
  });

  it('never shows a player a name that was bent to suit a package', () => {
    for (const word of Object.values(RESOURCE_WORDS)) {
      expect(word).not.toMatch(/natural|[A-Z].*[A-Z]/);
    }
  });
});

describe('what a resource reads as', () => {
  it('is one number when nothing is pledged against it', () => {
    expect(saysStock(stock({ total: 1204 }), noon)).toBe((1204).toLocaleString());
  });

  it('is what is free over the total when something is', () => {
    expect(saysStock(stock({ total: 100, pledged: 35 }), noon)).toBe('65/100');
  });

  it('reads nothing free rather than a negative when everything is pledged', () => {
    expect(saysStock(stock({ total: 40, pledged: 40 }), noon)).toBe('0/40');
  });

  it('counts the rate in, so a growing stock says what it stands at now', () => {
    expect(saysStock(stock({ total: 100, ratePerSecond: 2 }), noon + 30_000)).toBe('160');
  });
});

import { describe, expect, it } from 'vitest';

import type { Stock } from '@villages/protocol';

import { RESOURCES_IN_ORDER, RESOURCE_WORDS, saysIncome, saysRate, saysStock } from './describe';

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

describe('what a house is paid', () => {
  it('says a rate a world month at a time, which is a real day, and nothing for a stock standing still', () => {
    expect(saysRate(stock({ ratePerSecond: 3 / 86_400 }))).toBe('+3 a month');
    expect(saysRate(stock({ ratePerSecond: -0.5 / 86_400 }))).toBe('-0.5 a month');
    expect(saysRate(stock())).toBeUndefined();
  });

  it('says every resource it is paid in, in the order they are shown, or that it is paid nothing', () => {
    const still = stock();
    const resources = {
      wealth: stock({ ratePerSecond: 6 / 86_400 }),
      naturalDomain: stock({ ratePerSecond: 3 / 86_400 }),
      influence: still,
      reason: still,
      piety: still,
    };

    expect(saysIncome(resources)).toBe('paid Wealth +6 a month, Domain +3 a month');
    expect(saysIncome({ ...resources, wealth: still, naturalDomain: still })).toBe('paid nothing');
  });
});

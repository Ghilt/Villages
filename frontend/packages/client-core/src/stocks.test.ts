import { describe, expect, it } from 'vitest';

import type { Stock } from '@villages/protocol';

import { freeNow, stockNow } from './stocks';

const noon = 1_788_609_600_000;

function stock(over: Partial<Stock> = {}): Stock {
  return { total: 100, pledged: 0, ratePerSecond: 0, asOf: noon, ...over };
}

describe('what a stock stands at', () => {
  it('is what it was, when nothing has passed', () => {
    expect(stockNow(stock(), noon)).toBe(100);
  });

  it('is what it was plus what the rate has earned since', () => {
    expect(stockNow(stock({ ratePerSecond: 2 }), noon + 30_000)).toBe(160);
  });

  it('does not count a part-earned unit, so it never runs ahead of the server', () => {
    expect(stockNow(stock({ total: 0, ratePerSecond: 0.3 }), noon + 10_000)).toBe(3);
    expect(stockNow(stock({ total: 0, ratePerSecond: 0.3 }), noon + 9_999)).toBe(2);
  });

  it('is what it was before the instant it was true, rather than running backwards', () => {
    expect(stockNow(stock({ ratePerSecond: 1 }), noon - 60_000)).toBe(100);
  });

  it('stands still when the rate is zero, however long you look', () => {
    expect(stockNow(stock(), noon + 100_000_000)).toBe(100);
  });
});

describe('what is free of a stock', () => {
  it('is the total less what the pledges hold', () => {
    expect(freeNow(stock({ pledged: 35 }), noon)).toBe(65);
  });

  it('grows with the rate, because a pledge holds an amount and not a share', () => {
    expect(freeNow(stock({ pledged: 35, ratePerSecond: 1 }), noon + 10_000)).toBe(75);
  });

  it('is nothing at all when everything is pledged', () => {
    expect(freeNow(stock({ pledged: 100 }), noon)).toBe(0);
  });
});

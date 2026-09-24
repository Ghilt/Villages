import type { Stock } from '@villages/protocol';

/**
 * What a resource stands at, worked out from the rate rather than asked for.
 *
 * The server says a stock once and again only when it changes; between times anyone holding it can work
 * out the total now, which is what lets the world have no tick events. See decision record 0006.
 *
 * This lives here rather than in the interface because it is arithmetic over the protocol and nothing
 * else - no DOM, no React, no map. It is what this package's own description has always claimed.
 */

/** The total now: what it was, plus what the rate has earned since. Before `asOf`, what it was. */
export function stockNow(stock: Stock, now: number): number {
  const seconds = Math.max(0, (now - stock.asOf) / 1000);
  return Math.floor(stock.total + stock.ratePerSecond * seconds);
}

/**
 * What a house may actually do something with: the total now, less what its pledges hold.
 *
 * A part-earned unit is not earned, so this floors before subtracting and can never read higher than the
 * server would allow a house to spend.
 */
export function freeNow(stock: Stock, now: number): number {
  return stockNow(stock, now) - stock.pledged;
}

/** How often a stock is redrawn. A resource is a rate, so a still number would be a lie once one moves. */
export const TICK_MS = 250;

import { useEffect, useState } from 'react';

/**
 * A number that moves while nobody is told: a resource is a rate, so what it stands at is worked out
 * rather than sent (decision record 0006), and a readout says it again every so often while it is moving.
 *
 * The library does not know what a stock is. The game hands a readout what it stands at, at a moment -
 * `stockNow` over the house's own stock - and how fast it moves, and the readout does the asking.
 */

/** How often a moving amount is said again: four times a second, as the house card says its own. */
export const READOUT_TICK_MS = 250;

/** Which way an amount is going, from how fast. */
export type Trend = 'rising' | 'falling' | 'still';

export function trendOf(ratePerSecond: number | undefined): Trend {
  if (ratePerSecond === undefined || ratePerSecond === 0 || !Number.isFinite(ratePerSecond)) {
    return 'still';
  }
  return ratePerSecond > 0 ? 'rising' : 'falling';
}

/** An amount as it is read: a number grouped in thousands, or words the game has already put it in. */
export function amountSaid(amount: number | string): string {
  return typeof amount === 'string' ? amount : amount.toLocaleString();
}

/** The time now, asked again every `every` milliseconds while `ticking`, and once otherwise. */
export function useNow(ticking: boolean, every = READOUT_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) {
      return;
    }
    const tick = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(tick);
  }, [ticking, every]);
  return now;
}

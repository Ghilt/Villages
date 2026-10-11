import { stockNow } from '@villages/client-core';
import type { HouseView, ResourceName, Stock } from '@villages/protocol';

/**
 * Saying what a house is, in the words the interface uses for it.
 *
 * One copy. These were written twice, the same two functions in `hud/HudShell.tsx` and
 * `inspect/Inspector.tsx`, because the second surface to need them copied the first. Both mechanics -
 * **house status** and the **inspect window** - are about saying what a house is, so they were always going
 * to want the same words, and two copies is how they quietly stop being the same words.
 */

/** A banner in the words a herald would use, until the banner itself is drawn. */
export function blazon(house: HouseView): string {
  return `${house.banner.field}, a ${house.banner.charge} ${house.banner.chargeTincture}`;
}

/**
 * What a player calls each resource.
 *
 * **The one place the code's names become the player's.** The wire says `naturalDomain` because `domain`
 * already names the innermost layer of the server; a player has never heard of that and is shown Domain.
 * The qualifier belongs to the code and never to the person reading the screen. See the naming rule in
 * `BUILDING-A-MECHANIC.md`.
 */
export const RESOURCE_WORDS: Record<ResourceName, string> = {
  wealth: 'Wealth',
  naturalDomain: 'Domain',
  influence: 'Influence',
  reason: 'Reason',
  piety: 'Piety',
};

/**
 * The order they are shown in: what is spent, then what gates, then what is pledged.
 *
 * Not alphabetical, because the three ways a resource behaves are worth reading as three groups, and a
 * player who learns the row once should find the same thing in the same place every time after.
 */
export const RESOURCES_IN_ORDER: readonly ResourceName[] = [
  'wealth',
  'naturalDomain',
  'influence',
  'reason',
  'piety',
];

/**
 * What one resource reads as beside its mark: what the house can use, and the total behind it.
 *
 * A resource with nothing pledged is one number, because a slash where nothing is held back is a question
 * a player has to answer for themselves. A resource with a pledge against it is free of total, in that
 * order, because what can be used is the more urgent of the two.
 */
export function saysStock(stock: Stock, now: number): string {
  const total = stockNow(stock, now);
  if (stock.pledged === 0) {
    return total.toLocaleString();
  }
  return `${(total - stock.pledged).toLocaleString()}/${total.toLocaleString()}`;
}

/** How many real seconds a world month lasts: a real day is a world month (decision record 0053). */
const SECONDS_A_MONTH = 86_400;

/** How fast a stock moves, a world month at a time, or nothing when it stands still: `+3 a month`. */
export function saysRate(stock: Stock): string | undefined {
  if (stock.ratePerSecond === 0) {
    return undefined;
  }
  const perMonth = stock.ratePerSecond * SECONDS_A_MONTH;
  return `${perMonth > 0 ? '+' : '-'}${Math.abs(perMonth).toLocaleString(undefined, { maximumFractionDigits: 1 })} a month`;
}

/** What a house is paid, in every resource it is paid in: `paid Domain +3 a month`; or that it is paid nothing. */
export function saysIncome(resources: Record<ResourceName, Stock>): string {
  const paid = RESOURCES_IN_ORDER.flatMap((name) => {
    const rate = saysRate(resources[name]);
    return rate === undefined ? [] : [`${RESOURCE_WORDS[name]} ${rate}`];
  });
  return paid.length === 0 ? 'paid nothing' : `paid ${paid.join(', ')}`;
}

/** Where the seat is, to the three decimals that put it inside a master pixel. */
export function whereabouts(house: HouseView): string {
  const northing = `${Math.abs(house.seat.lat).toFixed(3)}° ${house.seat.lat >= 0 ? 'N' : 'S'}`;
  const easting = `${Math.abs(house.seat.lon).toFixed(3)}° ${house.seat.lon >= 0 ? 'E' : 'W'}`;
  return `${northing}, ${easting}`;
}

// What a stock stands at, and how often it is redrawn, are `stockNow` and `TICK_MS` in client-core:
// arithmetic over the protocol belongs beside the protocol, not in the pane that happens to draw it.

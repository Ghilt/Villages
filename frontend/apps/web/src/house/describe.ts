import type { HouseView } from '@villages/protocol';

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

/** The treasury as it stands now: an amount, a speed, and the instant that was true. See decision 0006. */
export function treasuryAt(house: HouseView, now: number): number {
  const seconds = Math.max(0, (now - house.treasury.asOf) / 1000);
  return Math.floor(house.treasury.amount + house.treasury.ratePerSecond * seconds);
}

/** Where the seat is, to the three decimals that put it inside a master pixel. */
export function whereabouts(house: HouseView): string {
  const northing = `${Math.abs(house.seat.lat).toFixed(3)}° ${house.seat.lat >= 0 ? 'N' : 'S'}`;
  const easting = `${Math.abs(house.seat.lon).toFixed(3)}° ${house.seat.lon >= 0 ? 'E' : 'W'}`;
  return `${northing}, ${easting}`;
}

/** How often a treasury is redrawn. A resource is a rate, so a still number would be a lie. */
export const TICK_MS = 250;

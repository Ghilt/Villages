import { monthsBetween } from '@villages/protocol';

/**
 * How old a character is on a world-day, in whole years.
 *
 * Worked out rather than told. A character's record holds the day they were born and the years they have
 * been aged out of the ordinary, and nothing at all is written as an ordinary year goes by, so an age is
 * the whole months from the birthday to the day, in years, and those years on top. See decision record
 * 0055.
 *
 * Never below nought. The server's rule against making somebody younger than a newborn counts a year as
 * three hundred and sixty-five days, because the domain has no calendar of its own, so it can let a
 * birthday land a few days after today; somebody that young is nought, and not minus one.
 */
export function ageOn(bornOn: number, agedYears: number, day: number): number {
  return Math.max(0, Math.floor(monthsBetween(bornOn, day) / 12) + agedYears);
}

/**
 * The world's calendar: how a count of world-days is read as a year and a day, and spelled. The other half
 * of `villages.protocol.Calendar` in Kotlin, held to the same vectors in `contracts/fixtures/calendar.json`.
 *
 * Years are three hundred and sixty-five days, every one of them; day zero is the first day of year one.
 * Months can come later, if the fiction wants them. See decision record 0027.
 */

export const DAYS_PER_YEAR = 365;

export function yearOf(day: number): number {
  return Math.floor(day / DAYS_PER_YEAR) + 1;
}

export function dayOfYearOf(day: number): number {
  return (day % DAYS_PER_YEAR) + 1;
}

export function dayOf(year: number, dayOfYear: number): number {
  if (year < 1) {
    throw new RangeError(`the world's calendar starts at year 1, not ${year}`);
  }
  if (dayOfYear < 1 || dayOfYear > DAYS_PER_YEAR) {
    throw new RangeError(`a year has ${DAYS_PER_YEAR} days, so there is no day ${dayOfYear}`);
  }
  return (year - 1) * DAYS_PER_YEAR + (dayOfYear - 1);
}

/** How a day is written for a person: the year, and the day within it when it is not the first. */
export function describeDay(day: number): string {
  const dayOfYear = dayOfYearOf(day);
  return dayOfYear === 1 ? `year ${yearOf(day)}` : `year ${yearOf(day)}, day ${dayOfYear}`;
}

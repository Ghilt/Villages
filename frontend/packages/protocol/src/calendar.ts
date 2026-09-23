/**
 * The world's calendar: how a count of world-days is read as a date, and spelled.
 *
 * It is Earth's calendar - the proleptic Gregorian one, leap years and uneven months and all - because the
 * world is a warped Earth and its months are Earth's months. Day zero is the first of January, year one.
 * Both ends of the wire compute this, because the browser shows a date and the server stores a day;
 * `contracts/fixtures/calendar.json` holds the vectors both are held to.
 *
 * The maths is the civil-from-days algorithm rather than `Date`, which cannot be trusted with year one:
 * `Date.UTC` maps two-digit years into the nineteen-hundreds. Kotlin uses `java.time.LocalDate` for the
 * same job, which is the same calendar by a different road; the fixture is what keeps them honest.
 *
 * A real day is a world month. See decision record 0053.
 */

/** Day zero is the first of January, year one, which is this many days before the Unix epoch. */
const BEFORE_EPOCH = 719_162;

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Spelled out, because a date is read aloud as words and not as a number with a suffix stuck on it. */
const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
  'twentieth',
  'twenty-first',
  'twenty-second',
  'twenty-third',
  'twenty-fourth',
  'twenty-fifth',
  'twenty-sixth',
  'twenty-seventh',
  'twenty-eighth',
  'twenty-ninth',
  'thirtieth',
  'thirty-first',
] as const;

export interface WorldDate {
  year: number;
  /** One to twelve. */
  month: number;
  dayOfMonth: number;
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** The date a world-day falls on. Howard Hinnant's civil-from-days, shifted to our day zero. */
export function dateOf(day: number): WorldDate {
  const z = day - BEFORE_EPOCH + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shifted = Math.floor((5 * dayOfYear + 2) / 153);
  const dayOfMonth = dayOfYear - Math.floor((153 * shifted + 2) / 5) + 1;
  const month = shifted + (shifted < 10 ? 3 : -9);
  return { year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, dayOfMonth };
}

/** The world-day a date falls on. The inverse of `dateOf`, and it refuses a date the calendar has not got. */
export function dayOf(year: number, month: number, dayOfMonth: number): number {
  if (year < 1) {
    throw new RangeError(`the world's calendar starts at year 1, not ${year}`);
  }
  if (month < 1 || month > 12) {
    throw new RangeError(`a year has twelve months, so there is no month ${month}`);
  }
  const held = daysInMonth(year, month);
  if (dayOfMonth < 1 || dayOfMonth > held) {
    throw new RangeError(
      `${MONTHS[month - 1]} of year ${year} has ${held} days, so there is no day ${dayOfMonth}`,
    );
  }
  const shiftedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + dayOfMonth - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468 + BEFORE_EPOCH;
}

export function yearOf(day: number): number {
  return dateOf(day).year;
}

export function monthOf(day: number): number {
  return dateOf(day).month;
}

export function dayOfMonthOf(day: number): number {
  return dateOf(day).dayOfMonth;
}

/**
 * The world-day a number of months later, which is how every span in the world is measured.
 *
 * The day of the month is held where it can be and pulled back where it cannot, so the thirty-first of
 * January and one month is the twenty-eighth of February rather than the third of March. A pledge made on
 * the last day of a long month ends on the last day of a short one, which is what a person would expect.
 */
export function plusMonths(day: number, months: number): number {
  const { year, month, dayOfMonth } = dateOf(day);
  const moved = (year - 1) * 12 + (month - 1) + months;
  const intoYear = Math.floor(moved / 12) + 1;
  const intoMonth = moved - (intoYear - 1) * 12 + 1;
  return dayOf(intoYear, intoMonth, Math.min(dayOfMonth, daysInMonth(intoYear, intoMonth)));
}

/** How a day is written for a person: the day, its month, and the year it falls in. */
export function describeDay(day: number): string {
  const { year, month, dayOfMonth } = dateOf(day);
  return `the ${ORDINALS[dayOfMonth - 1]} of ${MONTHS[month - 1]}, year ${year}`;
}

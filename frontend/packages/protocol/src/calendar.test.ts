import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  MONTHS,
  dateOf,
  dayOf,
  dayOfMonthOf,
  daysInMonth,
  describeDay,
  isLeapYear,
  monthOf,
  plusMonths,
  yearOf,
} from './calendar';

const fixture = JSON.parse(
  readFileSync(new URL('../../../../contracts/fixtures/calendar.json', import.meta.url), 'utf8'),
) as {
  months: string[];
  vectors: { name: string; year: number; month: number; dayOfMonth: number; day: number; said: string }[];
  spans: { name: string; from: number; months: number; to: number; said: string }[];
};

describe('the shared calendar vectors, which the Kotlin side is held to as well', () => {
  it('names the months as the fixture does', () => {
    expect([...MONTHS]).toEqual(fixture.months);
  });

  it.each(fixture.vectors)('reads $name both ways, and spells it', (vector) => {
    expect(yearOf(vector.day)).toBe(vector.year);
    expect(monthOf(vector.day)).toBe(vector.month);
    expect(dayOfMonthOf(vector.day)).toBe(vector.dayOfMonth);
    expect(dayOf(vector.year, vector.month, vector.dayOfMonth)).toBe(vector.day);
    expect(describeDay(vector.day)).toBe(vector.said);
  });

  it.each(fixture.spans)('steps $name', (span) => {
    expect(plusMonths(span.from, span.months)).toBe(span.to);
    expect(describeDay(span.to)).toBe(span.said);
  });
});

describe('the calendar', () => {
  it('goes from a day to a date and back to the same day, over sixteen centuries', () => {
    for (let day = 0; day < 600_000; day += 997) {
      const there = dateOf(day);

      expect(dayOf(there.year, there.month, there.dayOfMonth)).toBe(day);
    }
  });

  it('refuses a date the calendar has not got', () => {
    expect(() => dayOf(0, 1, 1)).toThrow(RangeError);
    expect(() => dayOf(1, 0, 1)).toThrow(RangeError);
    expect(() => dayOf(1, 13, 1)).toThrow(RangeError);
    expect(() => dayOf(1, 1, 0)).toThrow(RangeError);
    expect(() => dayOf(1, 1, 32)).toThrow(RangeError);
  });

  it('gives a leap day only to the years that have earned one', () => {
    expect(isLeapYear(1204)).toBe(true);
    expect(isLeapYear(1300)).toBe(false);
    expect(isLeapYear(1200)).toBe(true);
    expect(daysInMonth(1204, 2)).toBe(29);
    expect(daysInMonth(1300, 2)).toBe(28);
    expect(() => dayOf(1301, 2, 29)).toThrow(RangeError);
  });

  it('holds the day of the month where it can and pulls it back where it cannot', () => {
    expect(describeDay(plusMonths(dayOf(1200, 1, 31), 1))).toBe('the twenty-ninth of February, year 1200');
    expect(describeDay(plusMonths(dayOf(1201, 1, 31), 1))).toBe('the twenty-eighth of February, year 1201');
    expect(describeDay(plusMonths(dayOf(1200, 1, 15), 1))).toBe('the fifteenth of February, year 1200');
  });
});

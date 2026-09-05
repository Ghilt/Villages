import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { DAYS_PER_YEAR, dayOf, dayOfYearOf, describeDay, yearOf } from './calendar';

const fixture = JSON.parse(
  readFileSync(new URL('../../../../contracts/fixtures/calendar.json', import.meta.url), 'utf8'),
) as {
  daysPerYear: number;
  vectors: { name: string; year: number; dayOfYear: number; day: number; said: string }[];
};

describe('the shared calendar vectors, which the Kotlin side is held to as well', () => {
  it('has years as long as the fixture says', () => {
    expect(DAYS_PER_YEAR).toBe(fixture.daysPerYear);
  });

  it.each(fixture.vectors)('reads $name both ways, and spells it', (vector) => {
    expect(yearOf(vector.day)).toBe(vector.year);
    expect(dayOfYearOf(vector.day)).toBe(vector.dayOfYear);
    expect(dayOf(vector.year, vector.dayOfYear)).toBe(vector.day);
    expect(describeDay(vector.day)).toBe(vector.said);
  });
});

describe('the calendar', () => {
  it('goes from a day to a year and back to the same day', () => {
    for (let day = 0; day < 20000; day += 37) {
      expect(dayOf(yearOf(day), dayOfYearOf(day))).toBe(day);
    }
  });

  it('refuses a year before the first or a day a year has not got', () => {
    expect(() => dayOf(0, 1)).toThrow(RangeError);
    expect(() => dayOf(1, 0)).toThrow(RangeError);
    expect(() => dayOf(1, 366)).toThrow(RangeError);
  });
});

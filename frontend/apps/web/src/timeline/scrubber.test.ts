import { describe, expect, it } from 'vitest';

import { DAYS_PER_YEAR, dayOf } from '@villages/protocol';

import { LEAST_TRAVEL_YEARS, describeViewing, scrubberRange } from './scrubber';

/** Year 1247, day 112, with the world having opened in year 1200. */
const world = { today: dayOf(1247, 112), earliest: dayOf(1200, 1) };

describe('the scrubber range', () => {
  it('runs from the earliest anything is known to exist up to today, once there is more than fifty years of it', () => {
    const old = { today: dayOf(1247, 112), earliest: dayOf(1100, 1) };

    expect(scrubberRange(old)).toEqual({ from: dayOf(1100, 1), to: dayOf(1247, 112) });
  });

  it('always has at least fifty years of travel, so an empty world can still be looked back into', () => {
    const young = { today: dayOf(1247, 112), earliest: dayOf(1247, 112) };

    expect(scrubberRange(young).from).toBe(dayOf(1247, 112) - LEAST_TRAVEL_YEARS * DAYS_PER_YEAR);
  });

  it('never runs before the calendar began', () => {
    expect(scrubberRange({ today: 100, earliest: 100 }).from).toBe(0);
  });
});

describe('saying what day is being looked at', () => {
  it('says live and the day when the scrubber is at the end', () => {
    expect(describeViewing(null, world)).toBe('live, year 1247, day 112');
    expect(describeViewing(world.today, world)).toBe('live, year 1247, day 112');
  });

  it('says the day and how long ago it was, in days when recent', () => {
    expect(describeViewing(world.today - 1, world)).toBe('year 1247, day 111, 1 day ago');
    expect(describeViewing(world.today - 30, world)).toBe('year 1247, day 82, 30 days ago');
  });

  it('says the day and how long ago it was, in years when not', () => {
    expect(describeViewing(dayOf(1200, 1), world)).toBe('year 1200, 47 years ago');
  });
});

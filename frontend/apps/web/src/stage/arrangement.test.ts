import { describe, expect, it } from 'vitest';

import { arrangementFor, askedIn, type Arrangement, type Which } from './arrangement';

const ARRANGEMENTS: readonly Arrangement[] = ['firstAway', 'halfEach', 'secondAway'];
const BOTH: readonly Which[] = [0, 1];

/*
 * The two pure halves of the arrangement, which is where the standardising actually happened: three
 * settings, one value under both bays, and a mirrored pair that cannot come apart.
 */
describe('the three arrangements', () => {
  it('marks a strip on one bay and the rest on the other, or half on both', () => {
    expect([askedIn('firstAway', 0), askedIn('firstAway', 1)]).toEqual(['strip', 'full']);
    expect([askedIn('halfEach', 0), askedIn('halfEach', 1)]).toEqual(['small', 'small']);
    expect([askedIn('secondAway', 0), askedIn('secondAway', 1)]).toEqual(['full', 'strip']);
  });

  it('turns a bay asking for a size into the arrangement that gives it', () => {
    expect(arrangementFor(0, 'strip')).toBe('firstAway');
    expect(arrangementFor(0, 'small')).toBe('halfEach');
    expect(arrangementFor(0, 'full')).toBe('secondAway');
    expect(arrangementFor(1, 'strip')).toBe('secondAway');
    expect(arrangementFor(1, 'small')).toBe('halfEach');
    expect(arrangementFor(1, 'full')).toBe('firstAway');
  });

  // The control marks the wish, so asking for a size and reading the mark back has to be a round trip.
  it('marks back whatever was asked for, from either bay', () => {
    for (const which of BOTH) {
      for (const size of ['strip', 'small', 'full'] as const) {
        expect(askedIn(arrangementFor(which, size), which)).toBe(size);
      }
    }
  });

  /*
   * **Both put away is not reachable**, which 0045 wanted and enforced with a rule.
   *
   * There is no rule here. There is no arrangement that says it, which is a stronger thing: a player
   * cannot reach a pair of 44-pixel strips with half the stage of nothing between them, because the value
   * that would have to hold that state does not exist.
   */
  it('never puts both bays away, and never opens both out', () => {
    for (const how of ARRANGEMENTS) {
      const pair = [askedIn(how, 0), askedIn(how, 1)];
      expect(pair.filter((size) => size === 'strip').length).toBeLessThan(2);
      expect(pair.filter((size) => size === 'full').length).toBeLessThan(2);
    }
  });
});

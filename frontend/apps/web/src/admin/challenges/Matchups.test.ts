import { describe, expect, it } from 'vitest';

import { SHARES, shareClass, shareOf } from './Matchups';

describe('the grid of matchups', () => {
  it('colours side A winning most in the deepest blue, B winning most in the deepest red, and even in grey', () => {
    expect(shareClass(0.95).colour).toBe(SHARES.at(-1)!.colour);
    expect(shareClass(0.02).colour).toBe(SHARES[0]!.colour);
    expect(shareClass(0.5).colour).toBe('#f0efec');
    expect(shareClass(0.5).dark).toBe(false);
  });

  it('weighs a pairing by the runs either side won, leaving out the even ends', () => {
    expect(shareOf({ wonByA: 237, wonByB: 241, even: 422, pulled: 400, meanTug: -0.1 })).toBeCloseTo(
      0.4958,
      3,
    );
    expect(shareOf({ wonByA: 0, wonByB: 0, even: 900, pulled: 0, meanTug: 0 })).toBe(0.5);
  });

  it('has as many steps toward A as toward B', () => {
    const middle = SHARES.findIndex((one) => one.colour === '#f0efec');
    expect(middle).toBe(SHARES.length - 1 - middle);
  });
});

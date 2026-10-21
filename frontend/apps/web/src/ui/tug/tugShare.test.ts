import { describe, expect, it } from 'vitest';

import { shareOf, towardSaid } from './tugShare';

describe('the tug as a share', () => {
  it('is half each when even, and all one side’s at either end', () => {
    expect(shareOf(0)).toBe(50);
    expect(shareOf(100)).toBe(100);
    expect(shareOf(-100)).toBe(0);
    expect(shareOf(28.4)).toBeCloseTo(64.2);
  });

  it('never runs past an end', () => {
    expect(shareOf(140)).toBe(100);
    expect(shareOf(-120)).toBe(0);
  });

  it('says toward whom it leans, to a tenth', () => {
    expect(towardSaid(28.34, 'Varga', 'Brannock')).toBe('28.3 toward Varga');
    expect(towardSaid(-7, 'Varga', 'Brannock')).toBe('7 toward Brannock');
    expect(towardSaid(0.04, 'Varga', 'Brannock')).toBe('even');
  });
});

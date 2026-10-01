import { describe, expect, it } from 'vitest';

import { amountSaid, trendOf } from './readout';

describe('a readout', () => {
  it('knows which way its amount is going from how fast', () => {
    expect(trendOf(0.4)).toBe('rising');
    expect(trendOf(-0.02)).toBe('falling');
    expect(trendOf(0)).toBe('still');
    expect(trendOf(undefined)).toBe('still');
    expect(trendOf(Number.NaN)).toBe('still');
  });

  it('says a number grouped in thousands, and words as they were given', () => {
    expect(amountSaid(1240)).toBe((1240).toLocaleString());
    expect(amountSaid('830/1,240')).toBe('830/1,240');
  });
});

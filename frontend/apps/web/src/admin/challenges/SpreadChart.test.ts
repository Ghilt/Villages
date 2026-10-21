import { describe, expect, it } from 'vitest';

import { CLASSES, bandSaid, colourOf } from './SpreadChart';

describe('the heatmap of a batch', () => {
  it('colours a share by its class, lightest for the fewest runs and darkest for the most', () => {
    expect(colourOf(0.01)).toBe(CLASSES[0]!.colour);
    expect(colourOf(0.15)).toBe(CLASSES[3]!.colour);
    expect(colourOf(1)).toBe(CLASSES.at(-1)!.colour);
  });

  it('says each band in words, the two ends apart', () => {
    expect(bandSaid(0, 100)).toBe("pulled to B's end");
    expect(bandSaid(21, 100)).toBe("pulled to A's end");
    expect(bandSaid(1, 100)).toBe('between 90 and 100 toward B');
    expect(bandSaid(11, 100)).toBe('between 0 and 10 toward A');
    expect(bandSaid(20, 100)).toBe('between 90 and 100 toward A');
  });
});

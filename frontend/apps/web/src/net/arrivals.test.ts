import { describe, expect, it } from 'vitest';

import { NOTHING_ARRIVED, alsoArrived, describeArrival } from './arrivals';

const snapshot = (cell: string, houses: number, omitted?: number) => ({
  cell,
  houses: Array.from({ length: houses }, (_, index) => index),
  ...(omitted === undefined ? {} : { omitted }),
});

/** A burst of snapshots, folded in the order they arrived. */
const burst = (...frames: ReturnType<typeof snapshot>[]) => frames.reduce(alsoArrived, NOTHING_ARRIVED);

describe('counting a burst of snapshots', () => {
  it('adds the cells and what they carried', () => {
    const counted = burst(snapshot('12003122', 2), snapshot('12003123', 0), snapshot('12003132', 1));

    expect(counted.cells).toBe(3);
    expect(counted.houses).toBe(3);
    expect(counted.zoom).toBe(8);
  });

  it('adds what the cells held beyond what they sent', () => {
    expect(burst(snapshot('1200', 200, 40), snapshot('1201', 200, 2)).omitted).toBe(42);
  });

  it('names the whole world by its own depth, which is none', () => {
    expect(burst(snapshot('', 1)).zoom).toBe(0);
  });
});

describe('saying what arrived', () => {
  it('says nothing about a burst that brought nothing, because a pan is not news', () => {
    expect(describeArrival(burst(snapshot('12', 0), snapshot('13', 0)))).toBeNull();
    expect(describeArrival(NOTHING_ARRIVED)).toBeNull();
  });

  it('says how many cells answered, at what depth, and what they held', () => {
    expect(describeArrival(burst(snapshot('12', 21), snapshot('03', 21)))).toBe('2 cells at z2: 42 houses');
  });

  it('counts one of anything in the singular', () => {
    expect(describeArrival(burst(snapshot('1200312213', 1)))).toBe('1 cell at z10: 1 house');
  });

  it('says what was left out, because a screen showing most of a crowd should say so', () => {
    expect(describeArrival(burst(snapshot('1200', 200, 30)))).toBe(
      '1 cell at z4: 200 houses, 30 more not sent',
    );
  });

  it('speaks up for a cell that sent nothing but holds something, which is the cap talking', () => {
    expect(describeArrival(burst(snapshot('', 0, 7)))).toBe('1 cell at z0: 0 houses, 7 more not sent');
  });
});

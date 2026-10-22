import { describe, expect, it } from 'vitest';

import { sealsAt, spotAlong } from './sealPath';

const TIMING = { form: 2, lead: 4 };

describe('a seal keeping time', () => {
  it('is nowhere before it forms, then forms in the mist, comes, and arrives on its second', () => {
    expect(sealsAt(3, [10], TIMING)).toEqual([]);
    expect(sealsAt(4, [10], TIMING)).toEqual([{ index: 0, state: 'forming', along: 0 }]);
    expect(sealsAt(6, [10], TIMING)).toEqual([{ index: 0, state: 'coming', along: 0 }]);
    expect(sealsAt(8, [10], TIMING)).toEqual([{ index: 0, state: 'coming', along: 0.5 }]);
    expect(sealsAt(10, [10], TIMING)).toEqual([{ index: 0, state: 'arrived', along: 1 }]);
  });

  it('stays arrived until the next arrives, and is spent for a second after', () => {
    const arrivals = [10, 20];
    expect(sealsAt(19, arrivals, TIMING)).toEqual([
      { index: 0, state: 'arrived', along: 1 },
      { index: 1, state: 'coming', along: 0.75 },
    ]);
    expect(sealsAt(20, arrivals, TIMING)).toEqual([
      { index: 0, state: 'spent', along: 1 },
      { index: 1, state: 'arrived', along: 1 },
    ]);
    expect(sealsAt(21, arrivals, TIMING)).toEqual([{ index: 1, state: 'arrived', along: 1 }]);
  });

  it('is coming before the first second when its happening arrives on the first', () => {
    expect(sealsAt(-3, [0], TIMING)).toEqual([{ index: 0, state: 'coming', along: 0.25 }]);
    expect(sealsAt(0, [0], TIMING)).toEqual([{ index: 0, state: 'arrived', along: 1 }]);
  });
});

describe('a spot along a path', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it('goes by length, the bend half way', () => {
    expect(spotAlong(path, 0)).toEqual({ x: 0, y: 0 });
    expect(spotAlong(path, 0.25)).toEqual({ x: 50, y: 0 });
    expect(spotAlong(path, 0.5)).toEqual({ x: 100, y: 0 });
    expect(spotAlong(path, 0.75)).toEqual({ x: 100, y: 50 });
    expect(spotAlong(path, 1)).toEqual({ x: 100, y: 100 });
  });

  it('keeps to the path past either end', () => {
    expect(spotAlong(path, -1)).toEqual({ x: 0, y: 0 });
    expect(spotAlong(path, 2)).toEqual({ x: 100, y: 100 });
  });
});

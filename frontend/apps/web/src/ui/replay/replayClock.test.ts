import { describe, expect, it } from 'vitest';

import { linePoints, nextPace, PACE_MS, scrubbedTo, secondAt, seenBands, shareAlong } from './replayClock';

describe('the replay’s clock', () => {
  it('goes round its three paces, slowest first', () => {
    expect(nextPace(1)).toBe(2);
    expect(nextPace(2)).toBe(3);
    expect(nextPace(3)).toBe(1);
    expect(PACE_MS[2]).toBeGreaterThan(PACE_MS[3]);
    expect(PACE_MS[1]).toBeGreaterThan(PACE_MS[2]);
  });

  it('moves a second a step of its pace, and stops at the last', () => {
    expect(secondAt(10, 0, 1, 60)).toBe(10);
    expect(secondAt(10, PACE_MS[1] * 3 + 5, 1, 60)).toBe(13);
    expect(secondAt(10, PACE_MS[3] * 3, 3, 60)).toBe(13);
    expect(secondAt(58, PACE_MS[1] * 10, 1, 60)).toBe(60);
  });

  it('lets a scrub go at a whole second inside the challenge', () => {
    expect(scrubbedTo(12.6, 60)).toBe(13);
    expect(scrubbedTo(-3, 60)).toBe(0);
    expect(scrubbedTo(75, 60)).toBe(60);
  });

  it('says how far along a second stands', () => {
    expect(shareAlong(30, 60)).toBe(50);
    expect(shareAlong(0, 60)).toBe(0);
    expect(shareAlong(60, 60)).toBe(100);
    expect(shareAlong(5, 0)).toBe(0);
  });
});

describe('the tug drawn along the replay', () => {
  it('runs from the first second at the left to the last at the right', () => {
    expect(linePoints([0, 100, -100], 100, 20)).toBe('0.0,10.0 50.0,0.0 100.0,20.0');
  });

  it('draws nothing for nothing, and a single second at the left', () => {
    expect(linePoints([], 100, 20)).toBe('');
    expect(linePoints([50], 100, 20)).toBe('0.0,5.0');
  });
});

describe('what has been seen of a replay', () => {
  const bands = [
    { from: 0, to: 15, name: 'Holy' },
    { from: 15, to: 30, name: 'Reason' },
    { from: 30, to: 45, name: 'Diplomacy' },
  ];

  it('is the happenings begun by the furthest second seen, the one going on cut there', () => {
    expect(seenBands(bands, 20)).toEqual([
      { from: 0, to: 15, name: 'Holy' },
      { from: 15, to: 20, name: 'Reason' },
    ]);
  });

  it('is the first happening alone at the first second, and every one once the last is seen', () => {
    expect(seenBands(bands, 0)).toEqual([{ from: 0, to: 0, name: 'Holy' }]);
    expect(seenBands(bands, 45)).toEqual(bands);
  });
});

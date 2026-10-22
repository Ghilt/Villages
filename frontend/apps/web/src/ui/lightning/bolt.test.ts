import { describe, expect, it } from 'vitest';

import { arcOf, boltAlong, crackleOn, forksOf, grownTo, leaderShare, randomOf, wanderOf } from './bolt';

const FROM = { x: 100, y: 400 };
const TO = { x: 700, y: 500 };

describe('a strike of lightning', () => {
  it('arches through the air: its arc rises above the straight way at its middle and ends where it strikes', () => {
    const arc = arcOf(FROM, TO, 120);
    expect(arc.at(0)).toEqual(FROM);
    expect(arc.at(1)).toEqual(TO);
    expect(arc.at(0.5).y).toBeCloseTo(450 - 120);
    expect(arc.length).toBeGreaterThan(Math.hypot(600, 100));
  });

  it('is a bolt from the source to what it strikes, jagged but never further off its arc than it may wander', () => {
    const arc = arcOf(FROM, TO, 120);
    const jag = { detail: 6, rough: 0.1 };
    const bolt = boltAlong(arc, 7, jag);
    expect(bolt).toHaveLength(65);
    expect(bolt[0]).toEqual(FROM);
    expect(bolt[64]!.x).toBeCloseTo(TO.x);
    expect(bolt[64]!.y).toBeCloseTo(TO.y);
    const offsets = wanderOf(7, jag, arc.length);
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThan(2 * jag.rough * arc.length);
    expect(new Set(offsets.map((offset) => Math.round(offset))).size).toBeGreaterThan(10);
  });

  it('is the same bolt for the same seed and another for another, which is how it flickers', () => {
    const arc = arcOf(FROM, TO, 120);
    const jag = { detail: 5, rough: 0.1 };
    expect(boltAlong(arc, 3, jag)).toEqual(boltAlong(arc, 3, jag));
    expect(boltAlong(arc, 4, jag)).not.toEqual(boltAlong(arc, 3, jag));
    expect(randomOf(9)()).toBe(randomOf(9)());
  });

  it('forks off its middle, each fork shorter than the bolt and starting on it', () => {
    const bolt = boltAlong(arcOf(FROM, TO, 120), 2, { detail: 6, rough: 0.1 });
    const forks = forksOf(bolt, 5, 4);
    expect(forks).toHaveLength(4);
    for (const fork of forks) {
      expect(bolt).toContainEqual(fork[0]);
      const end = fork[fork.length - 1]!;
      expect(Math.hypot(end.x - fork[0]!.x, end.y - fork[0]!.y)).toBeLessThan(Math.hypot(600, 100) * 0.4);
    }
  });

  it('crackles round the edge of what it reached, every arc near the edge', () => {
    const box = { x: 50, y: 60, width: 150, height: 40 };
    const arcs = crackleOn(box, 11, 5);
    expect(arcs).toHaveLength(10);
    for (const spot of arcs.flat()) {
      expect(spot.x).toBeGreaterThan(box.x - 30);
      expect(spot.x).toBeLessThan(box.x + box.width + 30);
      expect(spot.y).toBeGreaterThan(box.y - 30);
      expect(spot.y).toBeLessThan(box.y + box.height + 30);
    }
  });

  it('grows as a stepped leader: in jerks, never back, from nothing to the whole of it', () => {
    const shares = Array.from({ length: 101 }, (_, at) => leaderShare(at / 100, 7, 3));
    expect(shares[0]).toBe(0);
    expect(shares[100]).toBe(1);
    for (let at = 1; at < shares.length; at += 1) expect(shares[at]!).toBeGreaterThanOrEqual(shares[at - 1]!);
    expect(new Set(shares).size).toBeLessThanOrEqual(9);
  });

  it('can be cut part way along, ending between two of its points', () => {
    const bolt = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    expect(grownTo(bolt, 0.75)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 15, y: 0 },
    ]);
    expect(grownTo(bolt, 1)).toEqual(bolt);
  });
});

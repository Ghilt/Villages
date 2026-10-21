import { describe, expect, it } from 'vitest';

import { settlementSquare } from '../settlements.ts';
import { unitKey } from './course.ts';
import { ruinEnds, settlementEnds, settlementUnits } from './ends.ts';
import { placesJoined } from './graph.ts';
import type { RoadPlace } from './graph.ts';

const flat = () => 1;
const place = (id: string, x: number, y: number, kind: RoadPlace['kind'] = 'settlement'): RoadPlace => ({
  id,
  kind,
  x,
  y,
});
const pairs = (joins: readonly { a: string; b: string }[]) => joins.map((one) => `${one.a}-${one.b}`).sort();

describe('which places a road joins', () => {
  it('joins two places unless a third stands nearer both of them', () => {
    // a, b and c in a row: a to c goes through b, so there is no road straight from a to c.
    const row = [place('a', 100, 100), place('b', 130, 100), place('c', 160, 100)];
    expect(pairs(placesJoined(row, 100, flat))).toEqual(['a-b', 'b-c']);
  });

  it('never joins one ruin to another, so every road has somebody living at an end', () => {
    const joins = placesJoined(
      [place('r1', 100, 100, 'ruin'), place('r2', 120, 100, 'ruin'), place('s', 110, 140)],
      100,
      flat,
    );
    expect(pairs(joins)).toEqual(['r1-s', 'r2-s']);
  });

  it('joins every place to its nearest within the longest road, and nothing further', () => {
    const scattered = Array.from({ length: 60 }, (_, at) =>
      place(`p${at}`, 100 + ((at * 37) % 200), 100 + ((at * 91) % 170)),
    );
    const joins = placesJoined(scattered, 40, flat);
    for (const one of scattered) {
      const nearest = scattered
        .filter((other) => other !== one)
        .reduce((best, other) =>
          Math.hypot(other.x - one.x, other.y - one.y) < Math.hypot(best.x - one.x, best.y - one.y)
            ? other
            : best,
        );
      if (Math.hypot(nearest.x - one.x, nearest.y - one.y) > 40) continue;
      expect(
        joins.some((join) => [join.a, join.b].includes(one.id) && [join.a, join.b].includes(nearest.id)),
      ).toBe(true);
    }
    expect(joins.every((join) => join.km <= 40)).toBe(true);
  });

  it('is the same in any order, shortest first', () => {
    const scattered = Array.from({ length: 40 }, (_, at) =>
      place(`p${at}`, 100 + ((at * 53) % 150), 100 + ((at * 29) % 140), at % 7 === 0 ? 'ruin' : 'settlement'),
    );
    const forwards = placesJoined(scattered, 50, flat);
    expect(placesJoined([...scattered].reverse(), 50, flat)).toEqual(forwards);
    for (let at = 1; at < forwards.length; at += 1)
      expect(forwards[at]!.km).toBeGreaterThanOrEqual(forwards[at - 1]!.km);
  });

  it('counts the kilometres a unit is where the two stand, fewer towards the poles', () => {
    const two = [place('a', 100, 100), place('b', 140, 100)];
    expect(placesJoined(two, 30, () => 1)).toEqual([]);
    expect(placesJoined(two, 30, () => 0.5)).toEqual([{ a: 'a', b: 'b', km: 20 }]);
  });
});

describe('where a road meets a place', () => {
  it('meets a settlement just outside its square, where each street leaves it, never over the square', () => {
    const square = settlementSquare(1000, 400, 13);
    const ends = settlementEnds(square);
    const covered = new Set(settlementUnits(square));
    expect(ends).toHaveLength(4);
    expect(covered.size).toBeGreaterThan(150);
    expect(covered.size).toBeLessThan(200);
    for (const end of ends) expect(covered.has(unitKey(Math.floor(end.x), Math.floor(end.y)))).toBe(false);
  });

  it('meets a walled ruin a step outside its gates, and an open one round its outline', () => {
    const town = { x: 500, y: 500, built: 10 };
    const gate = { x: 510, y: 500, piece: 6, culture: 0, rank: 0, height: 4 };
    // A step past the gate's own ground, which no road passes over.
    expect(ruinEnds(town, [gate])).toEqual([{ x: 512, y: 500, out: { x: 1, y: 0 } }]);
    const open = ruinEnds(town, []);
    expect(open).toHaveLength(16);
    for (const end of open) expect(Math.hypot(end.x - 500, end.y - 500)).toBeCloseTo(11.5, 6);
  });
});

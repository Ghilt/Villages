import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { AddedTown, Reviewed } from './review1790.ts';
import { TIERS, builtOf, parseRuins, peopleOf, reachOf, ruinsProblems, tierOf } from './ruins.ts';
import { MOST_REACH } from './stands.ts';

const RUINS = readFileSync(new URL('../../../../world/ruins.json', import.meta.url), 'utf8');
const REVIEW = JSON.parse(
  readFileSync(new URL('../../../../world/names/1790.json', import.meta.url), 'utf8'),
) as {
  towns: Record<string, Reviewed>;
  added: Record<string, AddedTown>;
};

const sample = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    tiers: { great: 250000, large: 80000, city: 30000, town: 10000, small: 0 },
    size: { perRootThousand: 1.25, least: 3, most: 42, ring: 0.3, unlisted: 3000 },
    towns: { Q90: [550000, 'Paris'], Q1792: [40000, 'Dantzic', 'a free city'] },
    ...over,
  });

describe('how big every town of 1790 was', () => {
  it('reads each town by its id, its people and its name of 1790', () => {
    const ruins = parseRuins(sample());
    expect(ruins.towns.get('Q90')).toEqual({ people: 550000, name: 'Paris' });
    expect(ruins.towns.get('Q1792')).toEqual({ people: 40000, name: 'Dantzic', why: 'a free city' });
  });

  it('gives a town it does not list the people of a hamlet', () => {
    const ruins = parseRuins(sample());
    expect(peopleOf(ruins, 'Q90')).toBe(550000);
    expect(peopleOf(ruins, 'Q1')).toBe(3000);
  });

  it('puts a town in the greatest tier whose fewest people it reaches', () => {
    const ruins = parseRuins(sample());
    expect(tierOf(ruins, 1100000)).toBe('great');
    expect(tierOf(ruins, 250000)).toBe('great');
    expect(tierOf(ruins, 249999)).toBe('large');
    expect(tierOf(ruins, 40000)).toBe('city');
    expect(tierOf(ruins, 3000)).toBe('small');
  });

  it('builds a bigger town over more ground, by the square root of its people, between the least and the most', () => {
    const ruins = parseRuins(sample());
    expect(builtOf(ruins, 100000)).toBeCloseTo(12.5);
    expect(builtOf(ruins, 400000)).toBeCloseTo(25);
    expect(builtOf(ruins, 1000)).toBe(3);
    expect(builtOf(ruins, 5000000)).toBe(42);
    expect(reachOf(ruins, 100000)).toBeCloseTo(16.25);
    let before = 0;
    for (const people of [1000, 3000, 10000, 50000, 200000, 900000]) {
      expect(builtOf(ruins, people)).toBeGreaterThanOrEqual(before);
      before = builtOf(ruins, people);
    }
  });

  it('refuses tiers out of order, a size a stand cannot hold, and a town that is not an id with its people', () => {
    expect(() =>
      parseRuins(sample({ tiers: { great: 10, large: 80000, city: 30000, town: 10000, small: 0 } })),
    ).toThrow('the tier large must take fewer people than great');
    expect(() =>
      parseRuins(sample({ size: { perRootThousand: 1, least: 3, most: 60, ring: 0.3, unlisted: 3000 } })),
    ).toThrow('past the 63.75 units a stand holds');
    expect(() => parseRuins(sample({ towns: { Paris: [550000, 'Paris'] } }))).toThrow(
      'Paris is not a Wikidata id',
    );
    expect(() => parseRuins(sample({ towns: { Q90: [550000.5, 'Paris'] } }))).toThrow('Q90 is not');
  });

  it('says where a town is not a town of 1790, or not by the name the review gives it then', () => {
    const ruins = parseRuins(
      sample({
        towns: { Q90: [550000, 'Lutetia'], Q65: [1000, 'Los Angeles'], Q123456789: [1000, 'Nowhere'] },
      }),
    );
    const problems = ruinsProblems(ruins, {
      towns: { Q90: ['Paris', 'Paris'], Q65: [null, 'Los Angeles'] },
      added: {},
    });
    expect(problems).toEqual([
      'Q90 is Paris in 1790, not Lutetia',
      'Q65 Los Angeles is not a town of 1790',
      'Q123456789 Nowhere is not a town of 1790',
    ]);
  });
});

describe('world/ruins.json', () => {
  const ruins = parseRuins(RUINS);

  it('lists only towns of 1790, each by the name the review gives it then', () => {
    expect(ruinsProblems(ruins, REVIEW)).toEqual([]);
  });

  it('keeps the largest ruins inside what a stand record holds', () => {
    expect(ruins.size.most * (1 + ruins.size.ring)).toBeLessThanOrEqual(MOST_REACH);
  });

  it('has towns in every tier, and puts every town it does not list in the least', () => {
    const tiers = new Set([...ruins.towns.values()].map((town) => tierOf(ruins, town.people)));
    expect([...tiers].sort()).toEqual([...TIERS].sort());
    expect(tierOf(ruins, ruins.size.unlisted)).toBe('small');
  });
});

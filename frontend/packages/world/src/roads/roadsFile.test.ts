import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { networkRules, parseRoads } from './roadsFile.ts';

const text = readFileSync(new URL('../../../../../world/roads.json', import.meta.url), 'utf8');

describe('world/roads.json', () => {
  it('reads, and gives the rules a network is routed by', () => {
    const rules = networkRules(parseRoads(text));
    expect(rules.longestSpan).toBeGreaterThan(0);
    expect(rules.trunk).toBeGreaterThan(0);
    expect(rules.trunk).toBeLessThanOrEqual(1);
    expect(rules.grades[1]).toBeGreaterThanOrEqual(rules.grades[0]);
  });

  it('is refused whole when a number is wrong, saying which', () => {
    const file = JSON.parse(text) as Record<string, unknown>;
    expect(() => parseRoads(JSON.stringify({ ...file, trunk: 0 }))).toThrow(/trunk/);
    expect(() => parseRoads(JSON.stringify({ ...file, ground: { farmland: 0.5 } }))).toThrow(/ground/);
    expect(() =>
      parseRoads(JSON.stringify({ ...file, bridges: { ...(file['bridges'] as object), biggestRiver: 2 } })),
    ).toThrow(/biggestRiver/);
    expect(() => parseRoads(JSON.stringify({ ...file, grades: { road: 4, trunk: 2 } }))).toThrow(/grades/);
  });
});

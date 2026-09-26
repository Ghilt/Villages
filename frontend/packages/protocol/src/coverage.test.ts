import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { coverageOf } from './coverage';
import type { CoverageCircle } from './coverage';

type Place = { lat: number; lon: number };

const fixture = JSON.parse(
  readFileSync(new URL('../../../../contracts/fixtures/coverage.json', import.meta.url), 'utf8'),
) as {
  vectors: { name: string; tension: number; circles: CoverageCircle[]; place: Place; covered: boolean }[];
};

describe('the shared vectors, which the Kotlin side is held to as well', () => {
  it('has all of them', () => {
    expect(fixture.vectors).toHaveLength(17);
  });

  it.each(fixture.vectors)('answers $name', (vector) => {
    expect(coverageOf(vector.circles, vector.tension).covers(vector.place)).toBe(vector.covered);
  });
});

describe('what nothing covers', () => {
  it('is everywhere', () => {
    expect(coverageOf([], 40).covers({ lat: 50, lon: 15 })).toBe(false);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { reaches } from './reach';

type Place = { lat: number; lon: number };

const fixture = JSON.parse(
  readFileSync(new URL('../../../../contracts/fixtures/reach.json', import.meta.url), 'utf8'),
) as { vectors: { name: string; centre: Place; kilometres: number; place: Place; within: boolean }[] };

describe('the shared vectors, which the Kotlin side is held to as well', () => {
  it('has all of them', () => {
    expect(fixture.vectors).toHaveLength(11);
  });

  it.each(fixture.vectors)('answers $name', (vector) => {
    expect(reaches(vector.centre, vector.kilometres, vector.place)).toBe(vector.within);
  });
});

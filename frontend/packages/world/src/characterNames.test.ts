import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseCharacterNames } from './characterNames.ts';

const fixture = readFileSync(
  new URL('../../../../contracts/fixtures/character-names.json', import.meta.url),
  'utf8',
);
const world = readFileSync(
  new URL('../../../../world/catalogues/character-names.json', import.meta.url),
  'utf8',
);

describe('the character names', () => {
  it('reads the shared fixture as the server does', () => {
    const names = parseCharacterNames(fixture);
    expect([names.woman, names.man, names.family]).toEqual([
      ['Agnes', 'Ursula'],
      ['Anton', 'Wilhelm'],
      ['Achterberg', 'Ystad'],
    ]);
  });

  it('reads the real ones', () => {
    expect(parseCharacterNames(world).family.length).toBeGreaterThan(0);
  });

  it('refuses a list it cannot read, naming it', () => {
    expect(() => parseCharacterNames(fixture.replace('"family": [', '"family": [1, '))).toThrow(
      'world/catalogues/character-names.json: no family the page can read',
    );
  });
});

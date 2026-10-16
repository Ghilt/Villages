import { describe, expect, it } from 'vitest';

import { getAt, setAt, startsWith } from './draft';

describe('a catalogue being edited', () => {
  const file = {
    $comment: 'kept',
    types: { castle: { sightKm: [34, 40, 48], words: { european: 'castle' } } },
  };

  it('is changed at one place, every other field where it was and the original untouched', () => {
    const changed = setAt(file, ['types', 'castle', 'sightKm'], [36, 40, 48]);

    expect(JSON.stringify(changed)).toBe(
      '{"$comment":"kept","types":{"castle":{"sightKm":[36,40,48],"words":{"european":"castle"}}}}',
    );
    expect(file.types.castle.sightKm).toEqual([34, 40, 48]);
    expect(getAt(changed, ['types', 'castle', 'words'])).toBe(file.types.castle.words);
  });

  it('is changed in a list by its place in it, and whole at the empty path', () => {
    expect(getAt(setAt(file, ['types', 'castle', 'sightKm', 1], 41), ['types', 'castle', 'sightKm'])).toEqual(
      [34, 41, 48],
    );
    expect(setAt(file, [], { types: {} })).toEqual({ types: {} });
  });

  it('reads nothing where there is nothing', () => {
    expect(getAt(file, ['types', 'mill', 'sightKm'])).toBeUndefined();
  });

  it('knows a place inside another', () => {
    expect(startsWith(['types', 'castle', 'sightKm'], ['types', 'castle'])).toBe(true);
    expect(startsWith(['types', 'castle'], ['types', 'mill'])).toBe(false);
    expect(startsWith(['types'], [])).toBe(true);
  });
});

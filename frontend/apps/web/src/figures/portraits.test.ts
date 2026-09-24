import { describe, expect, it } from 'vitest';

import { anotherPortrait, portraitUrl, suits } from './portraits';

const FOLDER = ['man-01', 'man-02', 'woman-01', 'woman-02', 'woman-03'];

describe('a portrait', () => {
  it('is drawn from the dev server by its key', () => {
    expect(portraitUrl('woman-03')).toBe('/portraits/woman-03.png');
  });

  it('suits whom its name says first', () => {
    expect(suits('woman-03', 'woman')).toBe(true);
    expect(suits('woman-03', 'man')).toBe(false);
    // The dash is what makes it the first word of the name rather than a coincidence of spelling.
    expect(suits('manor-01', 'man')).toBe(false);
  });
});

describe('another portrait', () => {
  it('is one that suits them and is not the one they have', () => {
    expect(anotherPortrait(FOLDER, 'woman', 'woman-01', () => 0)).toBe('woman-02');
    expect(anotherPortrait(FOLDER, 'woman', 'woman-01', (count) => count - 1)).toBe('woman-03');
    expect(anotherPortrait(FOLDER, 'man', undefined, () => 1)).toBe('man-02');
  });

  it('is nobody when the folder has no other that suits them', () => {
    expect(anotherPortrait(['man-01', 'woman-01'], 'man', 'man-01', () => 0)).toBeNull();
  });
});

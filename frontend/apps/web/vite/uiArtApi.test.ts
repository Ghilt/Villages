import { describe, expect, it } from 'vitest';

import { isUiSource } from './uiArtApi.ts';

describe('the dev server keeping the interface pictures cut', () => {
  it('cuts again when a picture in a kind’s folder is saved', () => {
    expect(isUiSource('borders/gilt-simple.webp')).toBe(true);
    expect(isUiSource('embellishments\\cherub-standing.PNG')).toBe(true);
    expect(isUiSource('fills/parchment.jpg')).toBe(true);
  });

  it('cuts again when a border’s cuts are moved, or a face’s', () => {
    expect(isUiSource('borders/gilt-simple.json')).toBe(true);
    expect(isUiSource('controls/primary.json')).toBe(true);
  });

  it('is not set off by what no cut reads', () => {
    expect(isUiSource('moodboard.webp')).toBe(false);
    expect(isUiSource('placeholders.json')).toBe(false);
    expect(isUiSource('fills/notes.txt')).toBe(false);
    expect(isUiSource('medallions/compass.json')).toBe(false);
  });
});

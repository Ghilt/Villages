import { describe, expect, it } from 'vitest';

import { portraitKeys } from './portraitsApi.ts';

describe('the portraits the dev server offers', () => {
  it('are the pictures in the folder, by the names a character keeps, in order', () => {
    expect(portraitKeys(['woman-02.png', 'man-01.png', 'woman-01.png'])).toEqual([
      'man-01',
      'woman-01',
      'woman-02',
    ]);
  });

  it('leave out whatever is not a picture, or is named so the server could not keep it', () => {
    expect(
      portraitKeys(['notes.txt', 'Woman-01.png', 'man 01.png', '../man-01.png', `man-${'x'.repeat(40)}.png`]),
    ).toEqual([]);
  });
});

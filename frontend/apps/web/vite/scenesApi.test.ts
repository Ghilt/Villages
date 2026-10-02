import { describe, expect, it } from 'vitest';

import { sceneKeys } from './scenesApi.ts';

describe('the scenes the dev server offers', () => {
  it('are the pictures in the folder, by the names a dialogue gives its scene, in order', () => {
    expect(sceneKeys(['harbour.png', 'great-hall.png', 'notes.txt', 'Harbour.png'])).toEqual([
      'great-hall',
      'harbour',
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { RECIPES } from '../container/recipes';
import written from './pictures.json?raw';

/**
 * `pictures.json` names every picture the loading screen draws, for `vite/uiInPage.ts` to serve the page asking for
 * them with itself, so the screen's first frame is drawn whole. It is JSON because the dev server's tooling reads it
 * and cannot import the page's code; this holds it to what the screen draws, so a recipe changed is a list changed.
 */
describe("the loading screen's pictures", () => {
  it('are its frame and its sky, the plate its title stands on and the meter’s two faces', () => {
    const screen = RECIPES['screen.loading'];
    const plate = RECIPES['plate.place'];

    expect(JSON.parse(written)).toEqual([
      { kind: 'borders', name: screen.border },
      { kind: 'fills', name: screen.fill },
      { kind: 'borders', name: plate.border },
      { kind: 'controls', name: 'meter' },
      { kind: 'controls', name: 'meter-full' },
    ]);
  });
});

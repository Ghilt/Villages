import { afterEach, describe, expect, it } from 'vitest';

import { openDialogue } from './dialogues/openDialogue';
import { focusFigure } from './figures/focus';
import { closeAll, openOn } from './inspect/subjects';
import { heardWater } from './inspect/waters';
import { lookingNow } from './looking';

describe('what a roll says the page is looking at', () => {
  afterEach(() => {
    closeAll();
    openDialogue(null);
    focusFigure(null);
  });

  it('says nothing but empty windows with nothing open and no map', () => {
    expect(lookingNow()).toEqual({ inspectingHouses: [], inspectingCharacters: [], inspectingWaters: [] });
  });

  it('names the houses and the characters with windows open, newest first, and leaves areas out', () => {
    openOn({ kind: 'house', id: 'h1' });
    openOn({ kind: 'area', id: 'a1' });
    openOn({ kind: 'house', id: 'h2' });

    expect(lookingNow()).toMatchObject({ inspectingHouses: ['h2', 'h1'], inspectingCharacters: [] });
    openOn({ kind: 'character', id: 'c1' });
    expect(lookingNow().inspectingCharacters).toEqual(['c1']);
  });

  it('says where each window on water was opened, and never what the water is', () => {
    const vistula = heardWater({
      type: 'inspected',
      at: { lat: 52.25, lon: 21 },
      revealed: true,
      water: { kind: 'river', id: 'Q548', name: 'Vistula', of1790: false },
    })!;
    openOn({ kind: 'river', id: vistula.id });
    openOn({ kind: 'sea', id: 'never-heard' });

    expect(lookingNow().inspectingWaters).toEqual([{ lat: 52.25, lon: 21 }]);
  });

  it('names the dialogue being read and the key figure open', () => {
    openDialogue('d1');
    focusFigure('f1');

    expect(lookingNow()).toMatchObject({ dialogue: 'd1', figure: 'f1' });
  });
});

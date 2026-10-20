import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KEY_FIGURES_PANE } from '../figures/pane';
import { HOUSE_PANE } from '../house/pane';
import { MAP_PANE } from './panes';
// Compiled as the file loads, so that the first `fresh()` does not; see `bays.test.ts`.
import '../panes';

/**
 * Something arriving on a phone: a pane already standing in a bay stays in it, and only one standing in neither
 * takes one. Each test takes fresh modules configured as `main.tsx` configures them; see `bays.test.ts` for why.
 */
async function fresh() {
  vi.resetModules();
  const [bays, arrive, panes] = await Promise.all([import('./bays'), import('./arrive'), import('../panes')]);
  bays.configureBays(panes.STAGE_PANES);
  bays.stageIs('bays', 'rows');
  return { ...bays, ...arrive };
}

beforeEach(() => {
  vi.resetModules();
});

describe('something arriving on a phone', () => {
  // Adam's find of 2026-10-06: Take action, pressed in the letter beside the map, rolled a hand that took the
  // map's bay, so the letter and the map swapped places at every press.
  it('stays in the bay it is standing in, rather than swapping with the map', async () => {
    const { arrive, baysStore } = await fresh();
    expect(baysStore.get().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);

    // Twice, and looked at after each: the defect swapped them there and back again.
    arrive(HOUSE_PANE.id, { into: 'theMapsBay' });
    expect(baysStore.get().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);
    arrive(HOUSE_PANE.id, { into: 'theMapsBay' });
    expect(baysStore.get().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);
  });

  it('opens the bay it is standing in to be read, when that bay is a strip', async () => {
    const { arrive, baysStore } = await fresh();
    expect(baysStore.get().arrangement).toBe('secondAway');

    arrive(HOUSE_PANE.id, { into: 'theMapsBay' });

    expect(baysStore.get().arrangement).toBe('halfEach');
  });

  it('takes the bay it is pointed at, when it is pointed at one', async () => {
    const { arrive, baysStore } = await fresh();

    arrive(HOUSE_PANE.id, { into: 0 });

    expect(baysStore.get().holding).toEqual([HOUSE_PANE.id, MAP_PANE.id]);
  });

  it("takes the map's bay when it is standing in neither", async () => {
    const { arrive, baysStore } = await fresh();

    arrive(KEY_FIGURES_PANE.id, { into: 'theMapsBay' });

    expect(baysStore.get().holding).toEqual([KEY_FIGURES_PANE.id, HOUSE_PANE.id]);
  });
});

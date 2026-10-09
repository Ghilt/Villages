import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KEY_FIGURES_PANE } from '../figures/pane';
import { HOUSE_PANE } from '../house/pane';
import { MAP_PANE } from './panes';
// Compiled as the file loads, so that the first `fresh()` does not; see `bays.test.ts`.
import '../panes';

/**
 * Something arriving on a phone: a pane already standing in a bay stays in it, and one standing in neither
 * takes the bay it stands in, the top for a window and below for anything else. Each test takes fresh modules
 * configured as `main.tsx` configures them; see `bays.test.ts` for why.
 */
async function fresh() {
  vi.resetModules();
  const [bays, arrive, panes, subjects] = await Promise.all([
    import('./bays'),
    import('./arrive'),
    import('../panes'),
    import('../inspect/subjects'),
  ]);
  bays.configureBays(panes.STAGE_PANES);
  bays.stageIs('bays', 'rows');
  return { ...bays, ...arrive, ...subjects };
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
    arrive(HOUSE_PANE.id);
    expect(baysStore.get().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);
    arrive(HOUSE_PANE.id);
    expect(baysStore.get().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);
  });

  it('opens the bay it is standing in to be read, when that bay is a strip', async () => {
    const { arrive, baysStore } = await fresh();
    expect(baysStore.get().arrangement).toBe('secondAway');

    arrive(HOUSE_PANE.id);

    expect(baysStore.get().arrangement).toBe('halfEach');
  });

  it('takes the bay below when it is standing in neither, and is not a window', async () => {
    const { arrive, baysStore } = await fresh();

    arrive(KEY_FIGURES_PANE.id);

    expect(baysStore.get().holding).toEqual([MAP_PANE.id, KEY_FIGURES_PANE.id]);
    expect(baysStore.get().arrangement).toBe('halfEach');
  });

  it("takes the top, in the map's place, when it is a window", async () => {
    const { arrive, baysStore, openOn, paneIdOf } = await fresh();
    const castle = { kind: 'house', id: 'kettleby' } as const;

    openOn(castle);
    arrive(paneIdOf(castle));

    expect(baysStore.get().holding).toEqual([paneIdOf(castle), HOUSE_PANE.id]);
  });
});

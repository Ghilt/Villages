import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HOUSE_PANE } from '../house/pane';
import { inspectPane } from '../inspect/pane';
import { MAP_PANE, NAVIGATION_PANE } from './panes';
import { bayOnAPhone } from './phone';

/**
 * Where things stand on a phone: the map or one window on top, every other pane below, and nothing ever in the
 * other end's bay. Adam's word of 2026-10-08; see decision record 0109. Each test takes fresh modules configured
 * as `main.tsx` configures them, the windows from the same graph as the bays; see `bays.test.ts` for why.
 */
async function fresh() {
  vi.resetModules();
  const [bays, phone, arrive, panes, subjects, opening] = await Promise.all([
    import('./bays'),
    import('./phone'),
    import('./arrive'),
    import('../panes'),
    import('../inspect/subjects'),
    import('../inspect/opening'),
  ]);
  bays.configureBays(panes.STAGE_PANES);
  bays.stageIs('bays', 'rows');
  return { ...bays, ...phone, ...arrive, ...subjects, ...opening };
}

const KETTLEBY = { kind: 'house', id: 'kettleby' } as const;
const TAGUS = { kind: 'river', id: 'tagus' } as const;

beforeEach(() => {
  vi.resetModules();
});

describe('the bay a pane stands in on a phone', () => {
  it('is the top for the map and a window, and below for everything else', () => {
    expect(bayOnAPhone(MAP_PANE)).toBe(0);
    expect(bayOnAPhone(inspectPane(KETTLEBY))).toBe(0);
    expect(bayOnAPhone(HOUSE_PANE)).toBe(1);
    expect(bayOnAPhone(NAVIGATION_PANE)).toBe(1);
  });
});

describe('the top of a phone', () => {
  it('holds one window: a second takes the place of the first', async () => {
    const { baysStore, inspect, paneIdOf } = await fresh();

    inspect(KETTLEBY);
    inspect(TAGUS);

    expect(baysStore.get().holding).toEqual([paneIdOf(TAGUS), HOUSE_PANE.id]);
  });

  it('keeps the window a second replaced open, in no bay, to be gone back to', async () => {
    const { baysStore, inspect, paneIdOf, subjectsStore } = await fresh();

    inspect(KETTLEBY);
    inspect(TAGUS);
    inspect(KETTLEBY);

    expect(subjectsStore.get().open).toContainEqual(TAGUS);
    expect(baysStore.get().holding).toEqual([paneIdOf(KETTLEBY), HOUSE_PANE.id]);
  });

  it("gives the map back when the window on it closes, even one that took another window's place", async () => {
    const { baysStore, inspect, stopInspecting } = await fresh();

    inspect(KETTLEBY);
    inspect(TAGUS);
    stopInspecting(TAGUS);

    expect(baysStore.get().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);
  });

  it('gives the map back when the window on it stops existing out from under it', async () => {
    const { baysStore, closeOne, inspect } = await fresh();

    inspect(KETTLEBY);
    closeOne(KETTLEBY);

    expect(baysStore.get().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);
  });

  it('opens to half for a window, when it was put away', async () => {
    const { askFor, baysStore, inspect } = await fresh();
    askFor(MAP_PANE.id, 'strip');

    inspect(KETTLEBY);

    expect(baysStore.get().arrangement).toBe('halfEach');
  });
});

describe('below, on a phone', () => {
  it('gets the house back when what was there stops existing, whatever is on top', async () => {
    const { baysStore, closeOne, inspect, openOn, paneIdOf, put } = await fresh();
    inspect(KETTLEBY);
    // Something below that displaced nothing a bay could take back: the fall-back is the house, never the map.
    openOn(TAGUS);
    put(1, paneIdOf(TAGUS));

    closeOne(TAGUS);

    expect(baysStore.get().holding).toEqual([paneIdOf(KETTLEBY), HOUSE_PANE.id]);
  });
});

describe('going to a pane, from navigation', () => {
  it("puts a pane below, in navigation's place, and the map on top in a window's", async () => {
    const { baysStore, goTo, inspect, takeOver } = await fresh();
    inspect(KETTLEBY);
    takeOver(1, NAVIGATION_PANE.id);

    goTo(HOUSE_PANE.id);
    goTo(MAP_PANE.id);

    expect(baysStore.get().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);
  });

  it('opens the bay it goes to, when it was a strip', async () => {
    const { askFor, baysStore, goTo } = await fresh();
    askFor(MAP_PANE.id, 'strip');

    goTo(MAP_PANE.id);

    expect(baysStore.get().arrangement).toBe('halfEach');
  });
});

describe('the map shown, on a phone', () => {
  it('takes the top from a window, which stays open', async () => {
    const { baysStore, inspect, showMap, subjectsStore } = await fresh();
    inspect(KETTLEBY);

    showMap();

    expect(baysStore.get().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);
    expect(subjectsStore.get().open).toEqual([KETTLEBY]);
  });
});

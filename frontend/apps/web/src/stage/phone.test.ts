import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HOUSE_PANE } from '../house/pane';
import { inspectPane } from '../inspect/pane';
import { MAP_PANE, NAVIGATION_PANE } from './panes';
import { barButtons, bayOnAPhone } from './phone';

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

describe('the bottom bar', () => {
  it('puts the pane pressed below, opened to half when the bottom was put away', async () => {
    const { baysStore, pressInTheBar } = await fresh();
    expect(baysStore.get().arrangement).toBe('secondAway');

    pressInTheBar(NAVIGATION_PANE.id);

    expect(baysStore.get().holding).toEqual([MAP_PANE.id, NAVIGATION_PANE.id]);
    expect(baysStore.get().arrangement).toBe('halfEach');
  });

  it('puts the bottom away when the lit one is pressed, and opens it again when it is pressed again', async () => {
    const { askFor, baysStore, pressInTheBar } = await fresh();
    askFor(HOUSE_PANE.id, 'small');

    pressInTheBar(HOUSE_PANE.id);
    expect(baysStore.get().arrangement).toBe('secondAway');

    pressInTheBar(HOUSE_PANE.id);
    expect(baysStore.get().arrangement).toBe('halfEach');
  });

  it('leaves the top as it is: what is up there, and how big', async () => {
    const { askFor, baysStore, inspect, paneIdOf, pressInTheBar } = await fresh();
    inspect(KETTLEBY);
    askFor(paneIdOf(KETTLEBY), 'small');

    pressInTheBar(NAVIGATION_PANE.id);

    expect(baysStore.get().holding).toEqual([paneIdOf(KETTLEBY), NAVIGATION_PANE.id]);
    expect(baysStore.get().arrangement).toBe('halfEach');
  });

  it('has a mark for every pane that can stand below, in the order they are declared, and none for the top', async () => {
    const { panesOn } = await import('../panes');
    // Every pane there can be at once: the house, the key figures, the holdings, a question asked rather than Take
    // action at rest, a dialogue offered, a quest offered and Recent, and a window open.
    const all = panesOn('11110111', [KETTLEBY], () => null);
    const below = all.filter((pane) => bayOnAPhone(pane) === 1);

    expect(barButtons(all).map((button) => button.id)).toEqual(below.map((pane) => pane.id));
    expect(barButtons(all).map((button) => button.id)).not.toContain(MAP_PANE.id);
    expect(barButtons(all).at(-1)?.id).toBe(NAVIGATION_PANE.id);
  });
});

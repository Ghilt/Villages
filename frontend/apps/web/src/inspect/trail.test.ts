import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Subject } from './subjects';

/**
 * A browser's `localStorage` as a Map, because the web tests run in node.
 *
 * It is here rather than in a setup file because the trail is the only thing on the stage that reads the
 * previous page load, and the point of half these tests is what happens when reading it goes wrong.
 */
function stubStorage(seed: Record<string, string> = {}): Map<string, string> {
  const held = new Map(Object.entries(seed));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => void held.set(key, value),
    removeItem: (key: string) => void held.delete(key),
  });
  return held;
}

/** The module keeps state at the top level, so each test gets its own copy of it. */
async function freshTrail() {
  vi.resetModules();
  return import('./trail');
}

const HOUSE: Subject = { kind: 'house', id: 'abc-123' };
const AREA: Subject = { kind: 'area', id: 'def-456' };

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('the trail', () => {
  it('starts empty when nothing was ever remembered', async () => {
    stubStorage();
    const { trailNow } = await freshTrail();

    expect(trailNow()).toEqual([]);
  });

  it('puts what was just looked at at the front', async () => {
    stubStorage();
    const { remember, trailNow } = await freshTrail();

    remember(HOUSE, 'Ravenscar');
    remember(AREA, 'the vale');

    expect(trailNow().map((step) => step.name)).toEqual(['the vale', 'Ravenscar']);
  });

  // A trail that repeats itself is a trail with less in it.
  it('moves a thing looked at again rather than listing it twice', async () => {
    stubStorage();
    const { remember, trailNow } = await freshTrail();

    remember(HOUSE, 'Ravenscar');
    remember(AREA, 'the vale');
    remember(HOUSE, 'Ravenscar');

    expect(trailNow().map((step) => step.name)).toEqual(['Ravenscar', 'the vale']);
  });

  it('keeps a thing renamed under its new name, still once', async () => {
    stubStorage();
    const { remember, trailNow } = await freshTrail();

    remember(HOUSE, 'Ravenscar');
    remember(HOUSE, 'Ravenscar the Greater');

    expect(trailNow().map((step) => step.name)).toEqual(['Ravenscar the Greater']);
  });

  it('goes only so far back', async () => {
    stubStorage();
    const { remember, trailNow, TRAIL_KEEPS } = await freshTrail();

    for (let step = 0; step < TRAIL_KEEPS + 5; step += 1) {
      remember({ kind: 'house', id: `house-${step}` }, `House ${step}`);
    }

    expect(trailNow()).toHaveLength(TRAIL_KEEPS);
    expect(trailNow()[0]?.name).toBe(`House ${TRAIL_KEEPS + 4}`);
  });

  it('forgets one thing without forgetting the rest', async () => {
    stubStorage();
    const { forget, remember, trailNow } = await freshTrail();

    remember(HOUSE, 'Ravenscar');
    remember(AREA, 'the vale');
    forget(HOUSE);

    expect(trailNow().map((step) => step.name)).toEqual(['the vale']);
  });

  // The one thing on the stage that comes back from a previous page load; ARCHITECTURE.md says why.
  it('comes back after a reload', async () => {
    const held = stubStorage();
    const first = await freshTrail();
    first.remember(HOUSE, 'Ravenscar');

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => void held.set(key, value),
      removeItem: (key: string) => void held.delete(key),
    });
    const again = await freshTrail();

    expect(again.trailNow().map((step) => step.name)).toEqual(['Ravenscar']);
  });

  describe('what comes back is not trusted', () => {
    it('drops anything that is not a step', async () => {
      stubStorage({
        'villages.trail': JSON.stringify([
          { subject: { kind: 'house', id: 'ok' }, name: 'Kept', at: 1 },
          { subject: { kind: 'dragon', id: 'no' }, name: 'Dropped', at: 1 },
          { subject: { kind: 'area', id: 'no' }, at: 1 },
          'nonsense',
          null,
        ]),
      });
      const { trailNow } = await freshTrail();

      expect(trailNow().map((step) => step.name)).toEqual(['Kept']);
    });

    it('survives rubbish in the slot', async () => {
      stubStorage({ 'villages.trail': 'not json at all' });
      const { trailNow } = await freshTrail();

      expect(trailNow()).toEqual([]);
    });

    // A browser that will not remember is not a failure: the trail is a convenience, not state.
    it('survives a browser with no storage at all', async () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      });
      const { remember, trailNow } = await freshTrail();

      expect(trailNow()).toEqual([]);
      expect(() => remember(HOUSE, 'Ravenscar')).not.toThrow();
      expect(trailNow().map((step) => step.name)).toEqual(['Ravenscar']);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DialogueView } from '@villages/protocol';

import { DIALOGUE_PANE, HOUSE_PANE, MAP_PANE } from '../stage/panes';
import { arrivals } from './opening';

function dialogue(id: string, ending: DialogueView['ending'] = { kind: 'open' }): DialogueView {
  return {
    id,
    revision: 1,
    title: `The dialogue ${id}`,
    speakers: [{ id: 'messenger', party: 1, name: 'A messenger' }],
    said: [],
    next: [{ id: 'arrives', speaker: 'messenger', words: 'A letter.' }],
    options: [],
    ending,
  };
}

const ids = (some: readonly DialogueView[]) => some.map((one) => one.id);

/**
 * The bay manager keeps its state at the top level, so each test takes a fresh copy of it, with the
 * opening from the same graph so that the two are talking about the same bays. See `stage/bays.test.ts`.
 */
async function fresh() {
  vi.resetModules();
  const [bays, opening] = await Promise.all([import('../stage/bays'), import('./opening')]);
  return { ...bays, ...opening };
}

beforeEach(() => {
  vi.resetModules();
});

describe('what has arrived', () => {
  it('is every dialogue waiting in the first list a page is shown', () => {
    expect(ids(arrivals(new Set(), [dialogue('a'), dialogue('b')]))).toEqual(['a', 'b']);
  });

  // A step taken sends the list again with the same dialogue in it, and so does a reconnect.
  it('is nothing when the same dialogues come again', () => {
    const seen = new Set<string>();
    arrivals(seen, [dialogue('a')]);

    expect(arrivals(seen, [{ ...dialogue('a'), revision: 2 }])).toEqual([]);
  });

  it('is the one offered since, and not the ones before it', () => {
    const seen = new Set<string>();
    arrivals(seen, [dialogue('a')]);

    expect(ids(arrivals(seen, [dialogue('a'), dialogue('b')]))).toEqual(['b']);
  });

  // Finished before the page saw it: there is nothing waiting to open the pane for.
  it('is never a dialogue the page first saw finished', () => {
    const seen = new Set<string>();
    const lost = dialogue('a', { kind: 'lost', because: { kind: 'alive', character: 'c' } });

    expect(arrivals(seen, [lost, dialogue('b', { kind: 'completed' })])).toEqual([]);
    expect(arrivals(seen, [lost])).toEqual([]);
  });
});

describe('on a phone, a dialogue arriving', () => {
  it('takes the bay the map is not in, and opens it to half', async () => {
    const { baysStore, openOnArrival, stageIs } = await fresh();
    stageIs('bays', 'rows');

    openOnArrival([dialogue('a')]);

    expect(baysStore.get().holding).toEqual([MAP_PANE.id, DIALOGUE_PANE.id]);
    expect(baysStore.get().arrangement).toBe('halfEach');
    // Taken over rather than put there, so what it displaced is remembered.
    expect(baysStore.get().displaced[1]).toBe(HOUSE_PANE.id);
  });

  // The player opened the map out over it since, which put it away; a step taken is not an arrival.
  it('leaves it put away when the same list comes again', async () => {
    const { askFor, baysStore, openOnArrival, stageIs } = await fresh();
    stageIs('bays', 'rows');
    openOnArrival([dialogue('a')]);
    askFor(MAP_PANE.id, 'full');
    const before = baysStore.get();

    openOnArrival([{ ...dialogue('a'), revision: 2 }]);

    expect(baysStore.get()).toBe(before);
    expect(baysStore.get().arrangement).toBe('secondAway');
  });

  it('moves nothing for a list with nothing waiting in it', async () => {
    const { baysStore, openOnArrival, stageIs } = await fresh();
    stageIs('bays', 'rows');
    const before = baysStore.get();

    openOnArrival([dialogue('a', { kind: 'completed' })]);

    expect(baysStore.get()).toBe(before);
  });
});

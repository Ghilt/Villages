import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DialogueView, LineView } from '@villages/protocol';

import { MAP_PANE } from '../stage/panes';
import { DIALOGUE_PANE } from './pane';
import type { Room } from '../stage/panes';
import { type Beside, newlyReached } from './showing';
// Compiled as the file loads, so that the first `fresh()` does not; see `stage/bays.test.ts`.
import '../panes';

/**
 * The dialogues pane stands only while the house has been offered a dialogue, and the bay manager gives a bay
 * back the moment what it holds stops standing - so the page's gateway is one that has heard of one.
 */
const heard = vi.hoisted(() => ({ yourChoice: null, yourDialogues: [{}], yourHouse: null }));
vi.mock('../net/gateway', () => ({ sessionStore: { get: () => heard, watch: () => () => undefined } }));

const THE_SEAT = { lat: 60.776, lon: 14.927 };

function line(id: string, shows?: LineView['shows']): LineView {
  return shows === undefined
    ? { id, speaker: 'messenger', words: `The line ${id}.` }
    : { id, speaker: 'messenger', words: `The line ${id}.`, shows };
}

function letter(
  said: readonly string[] = [],
  ending: DialogueView['ending'] = { kind: 'open' },
): DialogueView {
  return {
    id: 'letter',
    revision: said.length + 1,
    title: 'A letter from the coast',
    speakers: [{ id: 'messenger', party: 1, name: 'A messenger' }],
    said: said.map((id) => ({ id, speaker: 'messenger', words: `The line ${id}.`, effects: [] })),
    next: [],
    options: [],
    ending,
  };
}

/** The bays, the windows and the map's camera, fresh for each test, from one graph with what shows. */
async function fresh() {
  vi.resetModules();
  const [bays, subjects, focus, showing, panes, arrive, opening] = await Promise.all([
    import('../stage/bays'),
    import('../inspect/subjects'),
    import('../map/focus'),
    import('./showing'),
    import('../panes'),
    import('../stage/arrive'),
    import('../inspect/opening'),
  ]);
  // Configured as `main.tsx` configures it, from the same graph as the subjects.
  bays.configureBays(panes.STAGE_PANES);
  const flights: { lat: number; lon: number }[] = [];
  focus.flyWith((place) => flights.push(place));
  // What the dialogue pane is handed, as the stage and `panes.tsx` hand it: the map and a window beside it.
  const room = { openBeside: (id: string) => arrive.openBeside(DIALOGUE_PANE.id, id) } as Room;
  const beside: Beside = {
    showMap: () => arrive.showMapBeside(DIALOGUE_PANE.id),
    window: (thing) => opening.inspectBeside(thing, room),
  };
  const showWhatIsReached = (dialogue: DialogueView, lines: readonly LineView[]) =>
    showing.showWhatIsReached(dialogue, lines, beside);
  return { ...bays, ...subjects, ...showing, showWhatIsReached, flights };
}

beforeEach(() => {
  vi.resetModules();
});

describe('what the lines reached show', () => {
  it('is each line that shows something, and none that shows nothing', () => {
    const reached = newlyReached(new Set(), 'letter', [
      line('arrives', { kind: 'place', at: THE_SEAT }),
      line('reads'),
      line('paid', { kind: 'house', id: 'fenwold' }),
    ]);

    expect(reached.map((one) => one.line)).toEqual(['arrives', 'paid']);
  });

  it('is nothing for a line that has shown its thing already', () => {
    const seen = new Set<string>();
    newlyReached(seen, 'letter', [line('arrives', { kind: 'place', at: THE_SEAT })]);

    expect(newlyReached(seen, 'letter', [line('arrives', { kind: 'place', at: THE_SEAT })])).toEqual([]);
  });

  // Two dialogues can both have a line called "arrives".
  it('tells the lines of one dialogue from the lines of another', () => {
    const seen = new Set<string>();
    newlyReached(seen, 'letter', [line('arrives', { kind: 'place', at: THE_SEAT })]);

    expect(newlyReached(seen, 'another', [line('arrives', { kind: 'place', at: THE_SEAT })])).toHaveLength(1);
  });
});

describe('in the spread, a line reached', () => {
  it('takes the camera to the place it shows, and moves no bay', async () => {
    const { baysStore, flights, showWhatIsReached } = await fresh();
    const before = baysStore.get();

    showWhatIsReached(letter(), [line('arrives', { kind: 'place', at: THE_SEAT })]);

    expect(flights).toEqual([THE_SEAT]);
    expect(baysStore.get()).toBe(before);
  });

  it('opens a window on the house it shows', async () => {
    const { showWhatIsReached, subjectsStore } = await fresh();

    showWhatIsReached(letter(), [line('paid', { kind: 'house', id: 'fenwold' })]);

    expect(subjectsStore.get().open).toEqual([{ kind: 'house', id: 'fenwold' }]);
  });

  it('shows it once, however often the conversation is drawn or opened again', async () => {
    const { flights, showWhatIsReached } = await fresh();
    const arrives = line('arrives', { kind: 'place', at: THE_SEAT });

    showWhatIsReached(letter(), [arrives]);
    showWhatIsReached(letter(), [arrives]);

    expect(flights).toHaveLength(1);
  });

  // The house can refuse a step - a purse too light - and then nothing was said.
  it('shows what an option shows once the house has taken it, and not as it is pressed', async () => {
    const { showWhatIsReached, subjectsStore, taking } = await fresh();
    taking('letter', line('accept', { kind: 'character', id: 'philip' }));

    showWhatIsReached(letter(), []);
    expect(subjectsStore.get().open).toEqual([]);

    showWhatIsReached(letter(['accept']), []);
    expect(subjectsStore.get().open).toEqual([{ kind: 'character', id: 'philip' }]);
  });

  // Read back, every line is among what has been said, and a line said is sent without what it shows.
  it('shows nothing for a dialogue read back', async () => {
    const { baysStore, flights, showWhatIsReached, subjectsStore } = await fresh();
    const before = baysStore.get();

    showWhatIsReached(letter(['arrives', 'reads', 'accept', 'paid'], { kind: 'completed' }), []);

    expect(flights).toEqual([]);
    expect(subjectsStore.get().open).toEqual([]);
    expect(baysStore.get()).toBe(before);
  });
});

describe('on a phone, a line reached', () => {
  it('shows the place in the bay the conversation is not in, and the two go to half each', async () => {
    const { askFor, baysStore, flights, put, showWhatIsReached, stageIs } = await fresh();
    stageIs('bays', 'rows');
    put(0, DIALOGUE_PANE.id);
    askFor(DIALOGUE_PANE.id, 'full');

    showWhatIsReached(letter(), [line('arrives', { kind: 'place', at: THE_SEAT })]);

    expect(flights).toEqual([THE_SEAT]);
    expect(baysStore.get().holding).toEqual([DIALOGUE_PANE.id, MAP_PANE.id]);
    expect(baysStore.get().arrangement).toBe('halfEach');
  });

  it('opens the window on the character it shows in the other bay, and the conversation stays', async () => {
    const { askFor, baysStore, paneIdOf, showWhatIsReached, stageIs, takeOver } = await fresh();
    stageIs('bays', 'rows');
    takeOver(1, DIALOGUE_PANE.id);
    askFor(DIALOGUE_PANE.id, 'full');

    showWhatIsReached(letter(), [line('answer', { kind: 'character', id: 'philip' })]);

    expect(baysStore.get().holding).toEqual([
      paneIdOf({ kind: 'character', id: 'philip' }),
      DIALOGUE_PANE.id,
    ]);
    expect(baysStore.get().arrangement).toBe('halfEach');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STRIP } from './bayBox';
import { askedIn, askingOf } from './arrangement';
import { MAP_PANE, NAVIGATION_PANE, sizeAsked, spreadWants } from './panes';
import { KEY_FIGURES_PANE } from '../figures/pane';
import { HOUSE_PANE } from '../house/pane';
import type { Subject } from '../inspect/subjects';
// Read once as the file loads and never used here: what `fresh()` configures the manager with is the whole game,
// every pane's drawing with the gateway and the protocol behind it, and compiling that inside the first test
// took all of its five seconds on a busy machine. Compiled here, before any test's clock starts, each fresh
// copy after it costs tens of milliseconds.
import '../panes';

/**
 * The bay manager: what is where, and how the stage is divided between the two of them.
 *
 * It had no test at all until 0046, and it is the module every one of that record's defects lived in. The
 * headline group below is the record's whole claim, and it is the one worth reading first: **nothing but
 * the control and an arrival moves the seam.** A takeover does not, navigating a row does not,
 * a window closing does not, and a pane ceasing to exist does not.
 *
 * The module keeps its state at the top level, so each test takes a fresh copy of it, configured as `main.tsx`
 * configures it and from the same fresh graph as the subjects it drives: importing `subjects` at the top
 * would hand back a different store from the one the manager is told about, and nothing would happen. The
 * pure helpers are imported normally at the top, because they hold no state.
 */
async function fresh() {
  vi.resetModules();
  const [bays, subjects, panes] = await Promise.all([
    import('./bays'),
    import('../inspect/subjects'),
    import('../panes'),
  ]);
  // What the game puts on the stage; and the layout tells the manager what it made of itself: a phone.
  bays.configureBays(panes.STAGE_PANES);
  bays.stageIs('bays', 'rows');
  return { ...bays, ...subjects };
}

const A_HOUSE: Subject = { kind: 'house', id: 'abc-123' };

beforeEach(() => {
  vi.resetModules();
});

describe('what each bay asks the layout for', () => {
  it('is the arrangement and nothing else', async () => {
    const { baysStore, askFor } = await fresh();

    askFor(MAP_PANE.id, 'full');
    expect(askingOf(baysStore.get())).toEqual(['big', { small: STRIP }]);

    askFor(MAP_PANE.id, 'small');
    expect(askingOf(baysStore.get())).toEqual(['big', 'big']);

    askFor(MAP_PANE.id, 'strip');
    expect(askingOf(baysStore.get())).toEqual([{ small: STRIP }, 'big']);
  });

  // The stage compares what the store hands back by identity, so this is not a nicety: a fresh array per
  // read is an infinite render, and an unchanged one means the layout is not even recomputed.
  it('hands back the same object while the arrangement has not changed', async () => {
    const { baysStore, put } = await fresh();
    const before = askingOf(baysStore.get());

    put(1, NAVIGATION_PANE.id);

    expect(askingOf(baysStore.get())).toBe(before);
  });

  it('opens on the map opened out, with the house status a strip beneath it', async () => {
    const { baysStore } = await fresh();

    expect(baysStore.get().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);
    expect(baysStore.get().arrangement).toBe('secondAway');
    expect(askingOf(baysStore.get())).toEqual(['big', { small: STRIP }]);
  });
});

/*
 * The headline. Every case here is a line Adam has complained about, stated as its opposite.
 *
 * The seam moved because the split was worked out from whatever pane happened to be standing in each bay,
 * so moving a pane resized the stage as a side effect of navigating. It is one value on the fold now, and
 * none of the verbs below can reach it.
 */
describe('the seam does not move', () => {
  it('when a takeover puts navigation in a bay, or gives the bay back again', async () => {
    const { baysStore, takeOver, giveBack } = await fresh();
    const before = baysStore.get().arrangement;

    takeOver(1, NAVIGATION_PANE.id);
    expect(baysStore.get().holding[1]).toBe(NAVIGATION_PANE.id);
    expect(baysStore.get().arrangement).toBe(before);

    giveBack(NAVIGATION_PANE.id);
    expect(baysStore.get().holding[1]).toBe(HOUSE_PANE.id);
    expect(baysStore.get().arrangement).toBe(before);
  });

  it('when a navigation row puts a pane somewhere, or swaps the two', async () => {
    const { baysStore, put } = await fresh();
    const before = baysStore.get().arrangement;

    put(1, NAVIGATION_PANE.id);
    expect(baysStore.get().arrangement).toBe(before);

    // A swap: the map is already up, so putting it in the other bay exchanges the two.
    put(1, MAP_PANE.id);
    expect(baysStore.get().holding).toEqual([NAVIGATION_PANE.id, MAP_PANE.id]);
    expect(baysStore.get().arrangement).toBe(before);
  });

  /*
   * A size used to travel with the pane that was given it, so swapping the two bays carried the strip
   * across with the pane. The bay is what is put away, not the pane in it.
   */
  it('when the two bays are swapped: the same bay is the strip, not the same pane', async () => {
    const { baysStore, askFor, put } = await fresh();

    askFor(MAP_PANE.id, 'strip');
    expect(askedIn(baysStore.get().arrangement, 0)).toBe('strip');

    put(1, MAP_PANE.id);

    expect(baysStore.get().holding).toEqual([HOUSE_PANE.id, MAP_PANE.id]);
    expect(askedIn(baysStore.get().arrangement, 0)).toBe('strip');
  });

  it('when a window closes and the bay goes back to what it displaced', async () => {
    const { baysStore, askFor, takeOver, giveBack } = await fresh();
    const windowId = 'inspect:house:abc-123';

    askFor(MAP_PANE.id, 'small');
    takeOver(1, windowId);
    giveBack(windowId);

    expect(baysStore.get().arrangement).toBe('halfEach');
  });

  // The manager watches the stores that say what exists and tidies up after all of them, which used to be
  // one more road to a resize.
  it('when a pane stops existing out from under the bay holding it', async () => {
    const { baysStore, askFor, takeOver, openOn, closeOne } = await fresh();

    openOn(A_HOUSE);
    askFor(MAP_PANE.id, 'small');
    takeOver(1, 'inspect:house:abc-123');
    closeOne(A_HOUSE);

    expect(baysStore.get().holding[1]).toBe(HOUSE_PANE.id);
    expect(baysStore.get().arrangement).toBe('halfEach');
  });
});

/*
 * The one thing besides the control that does move it, and it is deliberately not part of putting a pane
 * in a bay. A window opened on a clicked castle into a 44-pixel strip is a window nobody can read, so the
 * arrival asks for room; a pane merely put somewhere does not.
 */
describe('room to read', () => {
  it('opens a bay that is a strip to half', async () => {
    const { baysStore, askFor, roomToRead } = await fresh();

    askFor(HOUSE_PANE.id, 'strip');
    roomToRead(1);

    expect(baysStore.get().arrangement).toBe('halfEach');
  });

  it('leaves a bay that is already half or opened out exactly as it is', async () => {
    const { baysStore, askFor, roomToRead } = await fresh();

    askFor(HOUSE_PANE.id, 'full');
    roomToRead(1);
    expect(baysStore.get().arrangement).toBe('firstAway');

    askFor(HOUSE_PANE.id, 'small');
    roomToRead(1);
    expect(baysStore.get().arrangement).toBe('halfEach');
  });
});

describe('asking for a size', () => {
  it('does nothing for a pane the player has not got up', async () => {
    const { baysStore, askFor } = await fresh();
    const before = baysStore.get().arrangement;

    askFor('inspect:house:not-open', 'strip');

    expect(baysStore.get().arrangement).toBe(before);
  });

  /*
   * In the spread a tile's size is its own, so the two forms write to two different places and neither
   * can be reached from the other. One record for both meant a size chosen on a phone came back on the
   * desktop, which is half of what 0046 separated.
   */
  it('writes the tile size in the spread and the arrangement in the bays, never both', async () => {
    const { baysStore, askFor, stageIs } = await fresh();

    askFor(MAP_PANE.id, 'strip');
    expect(baysStore.get().arrangement).toBe('firstAway');
    expect(baysStore.get().heights).toEqual({});
    expect(baysStore.get().tiles).toEqual({});

    stageIs('spread', 'rows');
    askFor(HOUSE_PANE.id, 'strip');
    expect(baysStore.get().tiles).toEqual({ bottomLeft: 'strip' });
    expect(baysStore.get().arrangement).toBe('firstAway');
  });

  it('crossing the fold and back leaves both of them where they were', async () => {
    const { baysStore, askFor, stageIs } = await fresh();

    askFor(MAP_PANE.id, 'strip');
    stageIs('spread', 'rows');
    askFor(HOUSE_PANE.id, 'strip');
    stageIs('bays', 'rows');

    expect(baysStore.get().arrangement).toBe('firstAway');
    expect(baysStore.get().tiles).toEqual({ bottomLeft: 'strip' });
  });
});

/*
 * The corner in the spread: one size whichever of its tabs is up, which is decision record 0057.
 *
 * The control is in the tab bar and asks through whichever pane is up, and any of the three asking is the
 * corner asking; pressing a tab changes which of them is drawn and nothing else.
 */
describe('the corner, in the spread', () => {
  it('is the size any of its panes asked for, whichever of them asked', async () => {
    const { baysStore, askFor, stageIs } = await fresh();
    stageIs('spread', 'rows');

    askFor(KEY_FIGURES_PANE.id, 'full');

    for (const pane of [HOUSE_PANE, KEY_FIGURES_PANE, NAVIGATION_PANE]) {
      expect(sizeAsked(pane, baysStore.get())).toBe('full');
    }
    expect(baysStore.get().heights).toEqual({});
  });

  it('changes nothing about its size when a tab is pressed', async () => {
    const { baysStore, askFor, show, stageIs } = await fresh();
    stageIs('spread', 'rows');
    askFor(HOUSE_PANE.id, 'full');
    const panes = [MAP_PANE, HOUSE_PANE, KEY_FIGURES_PANE, NAVIGATION_PANE];
    const before = baysStore.get();

    show('bottomLeft', NAVIGATION_PANE.id);
    show('bottomLeft', KEY_FIGURES_PANE.id);

    expect(baysStore.get().showing).toEqual({ bottomLeft: KEY_FIGURES_PANE.id });
    expect(baysStore.get().tiles).toBe(before.tiles);
    expect(baysStore.get().heights).toBe(before.heights);
    expect(spreadWants(panes, baysStore.get())).toEqual(spreadWants(panes, before));
  });
});

describe('what is in each bay', () => {
  // With two bays there is nowhere else for the displaced one to go, and dropping it leaves a bay empty.
  it('swaps rather than dropping, when a pane already up is put in the other bay', async () => {
    const { baysStore, put } = await fresh();

    put(0, HOUSE_PANE.id);

    expect(baysStore.get().holding).toEqual([HOUSE_PANE.id, MAP_PANE.id]);
  });

  /*
   * Reachable in two gestures before 0046: put navigation top from its own list, then press the compass,
   * which opens it at the bottom. Both bays held navigation and the map was nowhere.
   */
  it('never holds the same pane twice, even when a takeover wants one already up', async () => {
    const { baysStore, put, takeOver } = await fresh();

    // Putting navigation top drops the map, which is what a row in its own list does; the takeover then
    // has to swap rather than write navigation into the bottom bay as well.
    put(0, NAVIGATION_PANE.id);
    takeOver(1, NAVIGATION_PANE.id);

    expect(baysStore.get().holding).toEqual([HOUSE_PANE.id, NAVIGATION_PANE.id]);
  });

  // A takeover is the world answering a click, so it is undone; a pane the player chose is not.
  it('remembers what a takeover displaced and puts it back', async () => {
    const { baysStore, takeOver, giveBack } = await fresh();

    takeOver(1, NAVIGATION_PANE.id);
    giveBack(NAVIGATION_PANE.id);

    expect(baysStore.get().holding[1]).toBe(HOUSE_PANE.id);
  });

  // What it displaced has since been put in the other bay, so putting it back would hold it twice.
  it('falls back to whichever fixed pane is not up, when what it displaced has gone elsewhere', async () => {
    const { baysStore, takeOver, put, giveBack } = await fresh();

    takeOver(1, NAVIGATION_PANE.id);
    put(0, HOUSE_PANE.id);
    giveBack(NAVIGATION_PANE.id);

    expect(baysStore.get().holding).toEqual([HOUSE_PANE.id, MAP_PANE.id]);
  });

  it('does nothing when asked to give back a pane that is in no bay', async () => {
    const { baysStore, giveBack } = await fresh();
    const before = baysStore.get().holding;

    giveBack(NAVIGATION_PANE.id);

    expect(baysStore.get().holding).toBe(before);
  });
});

describe('which bay is which', () => {
  it('is a top and a bottom cut into rows, and a left and a right cut into columns', async () => {
    const { stageIs, where } = await fresh();

    expect([where(0), where(1)]).toEqual(['top', 'bottom']);

    stageIs('bays', 'columns');
    expect([where(0), where(1)]).toEqual(['left', 'right']);
  });
});

describe('who is up in a shared tile', () => {
  // The corner opens on the house status because it is declared first, and what a player wants on
  // arriving is their own house rather than a list of the nowhere they have been.
  it('is the first pane declared into it until somebody presses a tab', async () => {
    const { show, showingIn } = await fresh();
    const sharing = [HOUSE_PANE, NAVIGATION_PANE];

    expect(showingIn('bottomLeft', sharing).id).toBe(HOUSE_PANE.id);

    show('bottomLeft', NAVIGATION_PANE.id);
    expect(showingIn('bottomLeft', sharing).id).toBe(NAVIGATION_PANE.id);
  });
});

describe('the listeners', () => {
  it('are told once per change, and not at all when nothing changed', async () => {
    const { askFor, put, baysStore } = await fresh();
    const heard = vi.fn();
    baysStore.watch(heard);

    askFor(HOUSE_PANE.id, 'small');
    expect(heard).toHaveBeenCalledTimes(1);

    // The same thing again, and a pane put where it already is: neither is news.
    askFor(HOUSE_PANE.id, 'small');
    put(1, HOUSE_PANE.id);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

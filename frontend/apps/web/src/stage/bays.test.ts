import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STRIP } from './bayBox';
import { arrangementFor, askedIn, type Arrangement, type Which } from './bays';
import {
  HOUSE_PANE,
  KEY_FIGURES_PANE,
  MAP_PANE,
  NAVIGATION_PANE,
  panesFor,
  sizeAsked,
  spreadWants,
} from './panes';
import type { Subject } from '../inspect/subjects';

/**
 * The bay manager: what is where, and how the stage is divided between the two of them.
 *
 * It had no test at all until 0046, and it is the module every one of that record's defects lived in. The
 * headline group below is the record's whole claim, and it is the one worth reading first: **nothing but
 * the control and an arrival moves the seam.** Pressing the compass does not, navigating a row does not,
 * a window closing does not, and a pane ceasing to exist does not.
 *
 * The module keeps its state at the top level, so each test takes a fresh copy of it the way
 * `inspect/trail.test.ts` does. Two things about that are worth knowing before adding a case:
 *
 * - `bays.ts` subscribes `tidyUp` to the subject and gateway stores **at import**, so a test that wants to
 *   drive either of them has to import it from the *same* fresh graph. {@link fresh} returns all of them
 *   together for that reason; importing `subjects` at the top of the file would hand back a different copy
 *   of the store from the one the manager is watching, and nothing would happen.
 * - the two pure helpers are imported normally at the top, because they hold no state.
 */
async function fresh() {
  vi.resetModules();
  const [bays, subjects] = await Promise.all([import('./bays'), import('../inspect/subjects')]);
  // The layout tells the manager what it made of itself, and every test here is about a phone.
  bays.stageIs('bays', 'rows');
  return { ...bays, ...subjects };
}

const ARRANGEMENTS: readonly Arrangement[] = ['firstAway', 'halfEach', 'secondAway'];
const BOTH: readonly Which[] = [0, 1];
const A_HOUSE: Subject = { kind: 'house', id: 'abc-123' };

beforeEach(() => {
  vi.resetModules();
});

/*
 * The two pure halves of the arrangement, which is where the standardising actually happened: three
 * settings, one value under both bays, and a mirrored pair that cannot come apart.
 */
describe('the three arrangements', () => {
  it('marks a strip on one bay and the rest on the other, or half on both', () => {
    expect([askedIn('firstAway', 0), askedIn('firstAway', 1)]).toEqual(['strip', 'full']);
    expect([askedIn('halfEach', 0), askedIn('halfEach', 1)]).toEqual(['small', 'small']);
    expect([askedIn('secondAway', 0), askedIn('secondAway', 1)]).toEqual(['full', 'strip']);
  });

  it('turns a bay asking for a size into the arrangement that gives it', () => {
    expect(arrangementFor(0, 'strip')).toBe('firstAway');
    expect(arrangementFor(0, 'small')).toBe('halfEach');
    expect(arrangementFor(0, 'full')).toBe('secondAway');
    expect(arrangementFor(1, 'strip')).toBe('secondAway');
    expect(arrangementFor(1, 'small')).toBe('halfEach');
    expect(arrangementFor(1, 'full')).toBe('firstAway');
  });

  // The control marks the wish, so asking for a size and reading the mark back has to be a round trip.
  it('marks back whatever was asked for, from either bay', () => {
    for (const which of BOTH) {
      for (const size of ['strip', 'small', 'full'] as const) {
        expect(askedIn(arrangementFor(which, size), which)).toBe(size);
      }
    }
  });

  /*
   * **Both put away is not reachable**, which 0045 wanted and enforced with a rule.
   *
   * There is no rule here. There is no arrangement that says it, which is a stronger thing: a player
   * cannot reach a pair of 44-pixel strips with half the stage of nothing between them, because the value
   * that would have to hold that state does not exist.
   */
  it('never puts both bays away, and never opens both out', () => {
    for (const how of ARRANGEMENTS) {
      const pair = [askedIn(how, 0), askedIn(how, 1)];
      expect(pair.filter((size) => size === 'strip').length).toBeLessThan(2);
      expect(pair.filter((size) => size === 'full').length).toBeLessThan(2);
    }
  });
});

describe('what each bay asks the layout for', () => {
  it('is the arrangement and nothing else', async () => {
    const { askingNow, askFor } = await fresh();

    askFor(MAP_PANE.id, 'full');
    expect(askingNow()).toEqual(['big', { small: STRIP }]);

    askFor(MAP_PANE.id, 'small');
    expect(askingNow()).toEqual(['big', 'big']);

    askFor(MAP_PANE.id, 'strip');
    expect(askingNow()).toEqual([{ small: STRIP }, 'big']);
  });

  // The stage compares what the store hands back by identity, so this is not a nicety: a fresh array per
  // read is an infinite render, and an unchanged one means the layout is not even recomputed.
  it('hands back the same object while the arrangement has not changed', async () => {
    const { askingNow, put } = await fresh();
    const before = askingNow();

    put(1, NAVIGATION_PANE.id);

    expect(askingNow()).toBe(before);
  });

  it('opens on the map opened out, with the house status a strip beneath it', async () => {
    const { baysNow, askingNow } = await fresh();

    expect(baysNow().holding).toEqual([MAP_PANE.id, HOUSE_PANE.id]);
    expect(baysNow().arrangement).toBe('secondAway');
    expect(askingNow()).toEqual(['big', { small: STRIP }]);
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
  it('when the compass puts navigation in a bay, or takes it away again', async () => {
    const { baysNow, takeOver, giveBack } = await fresh();
    const before = baysNow().arrangement;

    takeOver(1, NAVIGATION_PANE.id);
    expect(baysNow().holding[1]).toBe(NAVIGATION_PANE.id);
    expect(baysNow().arrangement).toBe(before);

    giveBack(NAVIGATION_PANE.id);
    expect(baysNow().holding[1]).toBe(HOUSE_PANE.id);
    expect(baysNow().arrangement).toBe(before);
  });

  it('when a navigation row puts a pane somewhere, or swaps the two', async () => {
    const { baysNow, put } = await fresh();
    const before = baysNow().arrangement;

    put(1, NAVIGATION_PANE.id);
    expect(baysNow().arrangement).toBe(before);

    // A swap: the map is already up, so putting it in the other bay exchanges the two.
    put(1, MAP_PANE.id);
    expect(baysNow().holding).toEqual([NAVIGATION_PANE.id, MAP_PANE.id]);
    expect(baysNow().arrangement).toBe(before);
  });

  /*
   * A size used to travel with the pane that was given it, so swapping the two bays carried the strip
   * across with the pane. The bay is what is put away, not the pane in it.
   */
  it('when the two bays are swapped: the same bay is the strip, not the same pane', async () => {
    const { baysNow, askFor, put } = await fresh();

    askFor(MAP_PANE.id, 'strip');
    expect(askedIn(baysNow().arrangement, 0)).toBe('strip');

    put(1, MAP_PANE.id);

    expect(baysNow().holding).toEqual([HOUSE_PANE.id, MAP_PANE.id]);
    expect(askedIn(baysNow().arrangement, 0)).toBe('strip');
  });

  it('when a window closes and the bay goes back to what it displaced', async () => {
    const { baysNow, askFor, takeOver, giveBack } = await fresh();
    const windowId = 'inspect:house:abc-123';

    askFor(MAP_PANE.id, 'small');
    takeOver(1, windowId);
    giveBack(windowId);

    expect(baysNow().arrangement).toBe('halfEach');
  });

  // The manager watches the stores that say what exists and tidies up after all of them, which used to be
  // one more road to a resize.
  it('when a pane stops existing out from under the bay holding it', async () => {
    const { baysNow, askFor, takeOver, openOn, closeOne } = await fresh();

    openOn(A_HOUSE);
    askFor(MAP_PANE.id, 'small');
    takeOver(1, 'inspect:house:abc-123');
    closeOne(A_HOUSE);

    expect(baysNow().holding[1]).toBe(HOUSE_PANE.id);
    expect(baysNow().arrangement).toBe('halfEach');
  });
});

/*
 * The one thing besides the control that does move it, and it is deliberately not part of putting a pane
 * in a bay. A window opened on a clicked castle into a 44-pixel strip is a window nobody can read; the
 * compass landing in one is fine, because navigation's strip is a list of ways on.
 */
describe('room to read', () => {
  it('opens a bay that is a strip to half', async () => {
    const { baysNow, askFor, roomToRead } = await fresh();

    askFor(HOUSE_PANE.id, 'strip');
    roomToRead(1);

    expect(baysNow().arrangement).toBe('halfEach');
  });

  it('leaves a bay that is already half or opened out exactly as it is', async () => {
    const { baysNow, askFor, roomToRead } = await fresh();

    askFor(HOUSE_PANE.id, 'full');
    roomToRead(1);
    expect(baysNow().arrangement).toBe('firstAway');

    askFor(HOUSE_PANE.id, 'small');
    roomToRead(1);
    expect(baysNow().arrangement).toBe('halfEach');
  });
});

describe('asking for a size', () => {
  it('does nothing for a pane the player has not got up', async () => {
    const { baysNow, askFor } = await fresh();
    const before = baysNow().arrangement;

    askFor('inspect:house:not-open', 'strip');

    expect(baysNow().arrangement).toBe(before);
  });

  /*
   * In the spread a tile's size is its own, so the two forms write to two different places and neither
   * can be reached from the other. One record for both meant a size chosen on a phone came back on the
   * desktop, which is half of what 0046 separated.
   */
  it('writes the tile size in the spread and the arrangement in the bays, never both', async () => {
    const { baysNow, askFor, stageIs } = await fresh();

    askFor(MAP_PANE.id, 'strip');
    expect(baysNow().arrangement).toBe('firstAway');
    expect(baysNow().heights).toEqual({});
    expect(baysNow().tiles).toEqual({});

    stageIs('spread', 'rows');
    askFor(HOUSE_PANE.id, 'strip');
    expect(baysNow().tiles).toEqual({ bottomLeft: 'strip' });
    expect(baysNow().arrangement).toBe('firstAway');
  });

  it('crossing the fold and back leaves both of them where they were', async () => {
    const { baysNow, askFor, stageIs } = await fresh();

    askFor(MAP_PANE.id, 'strip');
    stageIs('spread', 'rows');
    askFor(HOUSE_PANE.id, 'strip');
    stageIs('bays', 'rows');

    expect(baysNow().arrangement).toBe('firstAway');
    expect(baysNow().tiles).toEqual({ bottomLeft: 'strip' });
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
    const { baysNow, askFor, stageIs } = await fresh();
    stageIs('spread', 'rows');

    askFor(KEY_FIGURES_PANE.id, 'full');

    for (const pane of [HOUSE_PANE, KEY_FIGURES_PANE, NAVIGATION_PANE]) {
      expect(sizeAsked(pane, baysNow())).toBe('full');
    }
    expect(baysNow().heights).toEqual({});
  });

  it('changes nothing about its size when a tab is pressed', async () => {
    const { baysNow, askFor, show, stageIs } = await fresh();
    stageIs('spread', 'rows');
    askFor(HOUSE_PANE.id, 'full');
    const panes = panesFor([], false);
    const before = baysNow();

    show('bottomLeft', NAVIGATION_PANE.id);
    show('bottomLeft', KEY_FIGURES_PANE.id);

    expect(baysNow().showing).toEqual({ bottomLeft: KEY_FIGURES_PANE.id });
    expect(baysNow().tiles).toBe(before.tiles);
    expect(baysNow().heights).toBe(before.heights);
    expect(spreadWants(panes, baysNow())).toEqual(spreadWants(panes, before));
  });
});

describe('what is in each bay', () => {
  // With two bays there is nowhere else for the displaced one to go, and dropping it leaves a bay empty.
  it('swaps rather than dropping, when a pane already up is put in the other bay', async () => {
    const { baysNow, put } = await fresh();

    put(0, HOUSE_PANE.id);

    expect(baysNow().holding).toEqual([HOUSE_PANE.id, MAP_PANE.id]);
  });

  /*
   * Reachable in two gestures before 0046: put navigation top from its own list, then press the compass,
   * which opens it at the bottom. Both bays held navigation and the map was nowhere.
   */
  it('never holds the same pane twice, even when a takeover wants one already up', async () => {
    const { baysNow, put, takeOver } = await fresh();

    // Putting navigation top drops the map, which is what a row in its own list does; the takeover then
    // has to swap rather than write navigation into the bottom bay as well.
    put(0, NAVIGATION_PANE.id);
    takeOver(1, NAVIGATION_PANE.id);

    expect(baysNow().holding).toEqual([HOUSE_PANE.id, NAVIGATION_PANE.id]);
  });

  // A takeover is the world answering a click, so it is undone; a pane the player chose is not.
  it('remembers what a takeover displaced and puts it back', async () => {
    const { baysNow, takeOver, giveBack } = await fresh();

    takeOver(1, NAVIGATION_PANE.id);
    giveBack(NAVIGATION_PANE.id);

    expect(baysNow().holding[1]).toBe(HOUSE_PANE.id);
  });

  // What it displaced has since been put in the other bay, so putting it back would hold it twice.
  it('falls back to whichever fixed pane is not up, when what it displaced has gone elsewhere', async () => {
    const { baysNow, takeOver, put, giveBack } = await fresh();

    takeOver(1, NAVIGATION_PANE.id);
    put(0, HOUSE_PANE.id);
    giveBack(NAVIGATION_PANE.id);

    expect(baysNow().holding).toEqual([HOUSE_PANE.id, MAP_PANE.id]);
  });

  it('does nothing when asked to give back a pane that is in no bay', async () => {
    const { baysNow, giveBack } = await fresh();
    const before = baysNow().holding;

    giveBack(NAVIGATION_PANE.id);

    expect(baysNow().holding).toBe(before);
  });
});

describe('where the compass opens navigation', () => {
  /*
   * Adam's words are "the bottom/right pane", twice. 0043 read it as the bay that is not the map's, which
   * put the door somewhere else depending on what the player had been looking at.
   */
  it('is the second bay, whatever the player has swapped into it', async () => {
    const { NEAR_BAY, baysNow, put, takeOver } = await fresh();

    expect(NEAR_BAY).toBe(1);

    // The map swapped to the bottom: the old rule would have opened navigation at the top instead.
    put(1, MAP_PANE.id);
    takeOver(NEAR_BAY, NAVIGATION_PANE.id);

    expect(baysNow().holding[1]).toBe(NAVIGATION_PANE.id);
  });

  it('lands in a strip without opening it, because a strip of it is still a list of ways on', async () => {
    const { baysNow, askFor, takeOver } = await fresh();

    // The bottom bay put away, then the compass.
    askFor(MAP_PANE.id, 'full');
    takeOver(1, NAVIGATION_PANE.id);

    expect(baysNow().arrangement).toBe('secondAway');
    expect(askedIn(baysNow().arrangement, 1)).toBe('strip');
  });
});

describe('which bay is which', () => {
  it('is a top and a bottom cut into rows, and a left and a right cut into columns', async () => {
    const { stageIs, where } = await fresh();

    expect([where(0), where(1)]).toEqual(['top', 'bottom']);

    stageIs('bays', 'columns');
    expect([where(0), where(1)]).toEqual(['left', 'right']);
  });

  // Where a thing clicked on the map opens, so that the window does not cover what it is about.
  it('knows which bay the map is not in', async () => {
    const { awayFromTheMap, put } = await fresh();

    expect(awayFromTheMap()).toBe(1);

    put(1, MAP_PANE.id);
    expect(awayFromTheMap()).toBe(0);
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
    const { askFor, put, watchBays } = await fresh();
    const heard = vi.fn();
    watchBays(heard);

    askFor(HOUSE_PANE.id, 'small');
    expect(heard).toHaveBeenCalledTimes(1);

    // The same thing again, and a pane put where it already is: neither is news.
    askFor(HOUSE_PANE.id, 'small');
    put(1, HOUSE_PANE.id);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

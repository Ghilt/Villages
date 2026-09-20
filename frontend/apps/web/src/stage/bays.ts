import { note } from '../debug/log';
import { watchSubjects } from '../inspect/subjects';
import { watchGateway } from '../net/gateway';
import type { Asking, BayName } from './bayBox';
import { STRIP } from './bayBox';
import { HOUSE_PANE, MAP_PANE, type Pane, paneById, type PaneSize } from './panes';

/**
 * The bay manager: which pane is in each bay, and which are collapsed to a strip.
 *
 * A module with a listener set rather than a context, the same shape as the gateway, the selection, the
 * areas and the debug log, because that is what `useSyncExternalStore` wants and it keeps the state out of
 * the tree.
 *
 * It holds what is where and calls the arithmetic rather than keeping the answer, so there is exactly one
 * place that knows how the room is divided and it is a pure function with a test. See decision record 0040.
 *
 * **Nothing here survives a reload.** Which bay holds what is where the player is, not a preference they
 * set; the areas make the same choice for the same reason. What does persist - the phone toggle, the folded
 * sections - is Adam's and lives in `debug/stage.ts`.
 */

/** Which of the two. `0` is the top or the left, `1` is the bottom or the right. */
export type Which = 0 | 1;

/**
 * How the two bays divide the stage between them. Three settings, and there is no fourth.
 *
 * **A property of the fold, not of the panes in it.** A bay is not a pane's own room: it is one end of a
 * stage two things are sharing, and what happens to be standing in it has nothing to say about how much of
 * it there is. That is what makes moving a pane free - the compass puts navigation where the house status
 * was and the seam does not move, because the seam was never the house's.
 *
 * It is also what makes the three sizes mean the same thing on every pane, which they did not while each
 * declared its own pixel count: **a strip, half the stage, or the rest**. See decision record 0046.
 */
export type Arrangement = 'firstAway' | 'halfEach' | 'secondAway';

export interface BaysState {
  /** The pane in each bay, by id. */
  readonly holding: readonly [string, string];
  /** How the bays divide the stage. Read in the bays form and meaningless in the spread. */
  readonly arrangement: Arrangement;
  /**
   * How tall each pane asked its **tile** to be, in the spread. Read there and meaningless in the bays.
   *
   * Per pane, where {@link Arrangement} is per fold, and that difference is the whole reason these are two
   * fields rather than the one record they used to be. A tile is a pane's own and its height is its own
   * business; a bay is one end of a split and belongs to neither of the two panes dividing it. One record
   * for both meant a size chosen on a phone came back on the desktop - and meant the split was recomputed
   * from whoever had just been moved into a bay, which is the defect 0046 exists to remove.
   */
  readonly heights: Readonly<Partial<Record<string, PaneSize>>>;
  /**
   * What each bay was showing before something took it over, so that closing the thing puts it back.
   *
   * Only a takeover is remembered. A pane the player chose from **navigation** is a thing they asked for, and
   * undoing it later would be the interface second-guessing them.
   */
  readonly displaced: readonly [string | null, string | null];
  /**
   * Which pane is up in each tile that more than one of them shares, by bay name.
   *
   * A tile with one pane in it never appears here, and a tile whose fronted pane is not recorded shows the
   * first pane that declared itself into it - so the corner opens on the house status and not on an empty
   * trail. It is the tab bar's whole state. See decision record 0042.
   */
  readonly showing: Readonly<Partial<Record<BayName, string>>>;
}

/**
 * The map opened out with the house status a strip beneath it: the shape the bays open on.
 *
 * The game is read off the map, and the house card is 200 pixels of a phone's 844 that the player has not
 * asked for yet. Pressing the strip is the first gesture there is, and it teaches the whole control.
 */
const OPENS_ON: BaysState = {
  holding: [MAP_PANE.id, HOUSE_PANE.id],
  arrangement: 'secondAway',
  displaced: [null, null],
  showing: {},
  heights: {},
};

let state: BaysState = OPENS_ON;
const listeners = new Set<() => void>();

/**
 * What each bay asks the layout for, in each of the three arrangements.
 *
 * Three constants and not a derivation, which is the point. `useSyncExternalStore` compares what a store
 * hands back by identity, so this returns the **same object** across every change that is not an
 * arrangement change - and the stage does not so much as recompute its layout when the compass swaps a
 * pane. "Moving a pane does not resize the bays" stops being a behaviour to be careful about and becomes
 * an identity. It also retires the cache that used to sit here for the same identity reason.
 *
 * `bayBox` is untouched by any of it: `['big', 'big']` already meant half each and `[{ small }, 'big']`
 * already meant a strip and the rest, floor, cap and all. The arithmetic was never what was wrong.
 */
const ASKING: Readonly<Record<Arrangement, readonly [Asking, Asking]>> = {
  firstAway: [{ small: STRIP }, 'big'],
  halfEach: ['big', 'big'],
  secondAway: ['big', { small: STRIP }],
};

/**
 * Which size the control marks on the pane in this bay.
 *
 * The two bays are always a mirrored pair and can never disagree, because there is one value under both of
 * them. **Both put away is not reachable**, which decision 0045 wanted and had to enforce with a rule;
 * here there is no rule, because there is no arrangement that says it.
 */
export function askedIn(how: Arrangement, which: Which): PaneSize {
  if (how === 'halfEach') {
    return 'small';
  }
  return (how === 'firstAway' ? 0 : 1) === which ? 'strip' : 'full';
}

/**
 * What a bay asking for one of the three sizes means for the arrangement.
 *
 * The other bay follows by reading the same value rather than by having one written into it, which is what
 * 0045 had to do while the size was a pane's own. Asking for half *is* the arrangement; asking to be
 * opened out puts the other one away; asking to be put away opens the other one out.
 */
export function arrangementFor(which: Which, size: PaneSize): Arrangement {
  if (size === 'small') {
    return 'halfEach';
  }
  const away = size === 'strip' ? which : which === 0 ? 1 : 0;
  return away === 0 ? 'firstAway' : 'secondAway';
}

/**
 * What each of the three arrangements is called in the log.
 *
 * One line saying how the stage is divided, rather than two lines about two panes: it is one value, and a
 * log that reported it twice would be reporting the mechanism instead of the thing.
 */
const ARRANGED: Record<Arrangement, () => string> = {
  firstAway: () => `${where(0)} put away, ${where(1)} opened out`,
  halfEach: () => `half each, ${where(0)} and ${where(1)}`,
  secondAway: () => `${where(0)} opened out, ${where(1)} put away`,
};

/** What each size is called in the log, which is what the control's own labels say. */
const SAID: Record<PaneSize, string> = {
  strip: 'put away',
  small: 'back to its normal size',
  full: 'opened out',
};

/**
 * What the stage made of itself last time it laid out.
 *
 * Not part of the state: it is the layout's answer, not the manager's, and it changes on every resize. The
 * stage hands it back so that a line of the log reads the way Adam would say it out loud, and so that the
 * manager can tell whether putting a window somewhere means anything - in the spread there are no bays to
 * put it in.
 */
let cutAlong: 'rows' | 'columns' = 'rows';
let form: 'spread' | 'bays' = 'spread';

export function baysNow(): BaysState {
  return state;
}

export function watchBays(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The stage telling the manager what it made of itself. */
export function stageIs(which: 'spread' | 'bays', along: 'rows' | 'columns'): void {
  form = which;
  cutAlong = along;
}

export function formNow(): 'spread' | 'bays' {
  return form;
}

/** The bay that is not the map's, which is the one a thing clicked on the map goes into. */
export function awayFromTheMap(): Which {
  return state.holding[0] === MAP_PANE.id ? 1 : 0;
}

/**
 * The map's own bay, which is the big one.
 *
 * What the **choice roll** takes when the world asks something: reading it is the thing to do first, and
 * the pane beside it is already the small one. The map comes back when the choice is answered, because a
 * takeover remembers what it displaced.
 */
export function theMapsBay(): Which {
  return awayFromTheMap() === 0 ? 1 : 0;
}

/** What the player would call a bay, given how the stage is cut. */
export function where(which: Which): string {
  if (cutAlong === 'rows') {
    return which === 0 ? 'top' : 'bottom';
  }
  return which === 0 ? 'left' : 'right';
}

function settle(next: BaysState): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

function titleOf(id: string): string {
  return paneById(id)?.title ?? id;
}

/** What each bay is asking the layout for, which is the arrangement and nothing else. */
export function askingNow(): readonly [Asking, Asking] {
  return ASKING[state.arrangement];
}

/**
 * Which of the panes sharing a tile is up.
 *
 * The first of them until somebody presses a tab, which is why the corner opens on the house status: it is
 * declared before navigation, and what a player wants on arriving is their own house rather than a list of
 * the nowhere they have been.
 */
export function showingIn(where: BayName, sharing: readonly Pane[]): Pane {
  const chosen = state.showing[where];
  return sharing.find((pane) => pane.id === chosen) ?? sharing[0]!;
}

/** Bring a pane to the front of the tile it shares. What pressing a tab does. */
export function show(where: BayName, id: string): void {
  if (state.showing[where] === id) {
    return;
  }
  settle({ ...state, showing: { ...state.showing, [where]: id } });
  note('bay', `${where === 'bottomLeft' ? 'the corner' : where} shows ${titleOf(id)}`);
}

/**
 * Put a pane in a bay.
 *
 * A pane is in one bay or neither, never both, so putting one where the other bay already has it is a
 * **swap**: with two bays there is nowhere else for the displaced one to go, and dropping it would leave a
 * bay empty. This is what navigation's rows do, and it is a thing the player asked for, so nothing is
 * remembered to be put back afterwards.
 */
export function put(which: Which, id: string): void {
  if (paneById(id) === undefined || state.holding[which] === id) {
    return;
  }

  const other: Which = which === 0 ? 1 : 0;
  const displaced = state.holding[which];
  const swapping = state.holding[other] === id;
  const holding: [string, string] = which === 0 ? [id, state.holding[1]] : [state.holding[0], id];
  if (swapping) {
    holding[other] = displaced;
  }

  settle({ ...state, holding });
  note(
    'bay',
    swapping
      ? `${titleOf(id)} and ${titleOf(displaced)} swapped, ${titleOf(id)} now ${where(which)}`
      : `${where(which)}: ${titleOf(id)}, was ${titleOf(displaced)}`,
  );
}

/**
 * Ask for one of a pane's three sizes.
 *
 * The one control every pane has, in both forms. It replaced a chevron that could only put a pane away and
 * a second button on one pane that swapped between two sizes: they were the same question - how much of
 * the stage is this taking - asked twice with different words. See decision record 0045.
 *
 * **In the bays it names the arrangement**, which is 0045's rule with the mechanism taken out from under
 * it. It used to write the neighbour's size into the neighbour's own entry, and the two could then be
 * pulled apart by anything that moved a pane; now both bays read one value and the other follows because
 * there is nothing else for it to read.
 *
 * **In the spread a tile's height is its own**: there is nobody for it to speak for, because the map
 * behind it takes whatever is left over without being asked.
 */
export function askFor(id: string, size: PaneSize): void {
  if (paneById(id) === undefined) {
    return;
  }

  if (form !== 'bays') {
    if (state.heights[id] === size) {
      return;
    }
    settle({ ...state, heights: { ...state.heights, [id]: size } });
    note('bay', `${titleOf(id)} ${SAID[size]}`);
    return;
  }

  // A pane the player has not got up is in no bay, so there is no arrangement for it to name.
  const which = state.holding.indexOf(id) as Which | -1;
  if (which === -1) {
    return;
  }

  const how = arrangementFor(which, size);
  if (how === state.arrangement) {
    return;
  }

  settle({ ...state, arrangement: how });
  // The whole arrangement in one line, because it is one arrangement rather than two panes that happen to
  // agree, and because the log is the instrument Adam reads. See decision record 0023.
  note('bay', ARRANGED[how]());
}

/**
 * Open a bay to at least half, because something has arrived in it that is not worth arriving as a strip.
 *
 * The only thing besides the control that moves the seam, and it is deliberately **not** part of putting a
 * pane in a bay: the compass has to leave the seam exactly where it was, and a castle clicked on the map
 * has to open a window somebody can read. The difference is who asked - the player, or the world - and it
 * belongs where that is known rather than in here. So the arrival calls this and the compass does not.
 */
export function roomToRead(which: Which): void {
  if (askedIn(state.arrangement, which) !== 'strip') {
    return;
  }
  settle({ ...state, arrangement: 'halfEach' });
  note('bay', `${where(which)} opened to half, for something that arrived in it`);
}

/**
 * Something taking a bay over, rather than the player choosing to put it there.
 *
 * A thing clicked on the map lands in the bay that is not the map's, and what was there is remembered so
 * that closing the thing puts it back. That is the difference between this and {@link put}: one is the
 * world answering a click, the other is the player saying where they want something, and only the first is
 * undone afterwards.
 */
export function takeOver(which: Which, id: string): void {
  if (state.holding[which] === id) {
    return;
  }

  const other: Which = which === 0 ? 1 : 0;
  const was = state.holding[which];
  const holding: [string, string] = which === 0 ? [id, state.holding[1]] : [state.holding[0], id];
  // Taking over a bay with something that is standing in the *other* one is a swap, as putting it there
  // by hand is: with two bays there is nowhere else for the displaced pane to go, and without this both
  // bays end up holding the same pane. Reachable from one gesture - put navigation top from its own list,
  // then press the compass, which opens it at the bottom.
  if (state.holding[other] === id) {
    holding[other] = was;
  }
  const displaced: [string | null, string | null] = [...state.displaced] as [string | null, string | null];
  displaced[which] = was;

  settle({ ...state, holding, displaced });
  note('bay', `${where(which)}: ${titleOf(id)}, over ${titleOf(was)}`);
}

/**
 * Put back whatever a pane took the place of, if it took anyone's place.
 *
 * Called as a window closes. A pane that is in no bay, or that the player put there themselves, leaves
 * nothing to put back and this does nothing.
 */
/**
 * What goes back into a bay when whatever is in it leaves.
 *
 * What it displaced, or - if that has since gone, or it displaced nothing - whichever of the two fixed
 * panes is not already up. A bay is never empty.
 */
function whatGoesBack(which: Which): string {
  const other: Which = which === 0 ? 1 : 0;
  const remembered = state.displaced[which];
  return remembered !== null && remembered !== state.holding[other] && paneById(remembered) !== undefined
    ? remembered
    : state.holding[other] === MAP_PANE.id
      ? HOUSE_PANE.id
      : MAP_PANE.id;
}

export function giveBack(id: string): void {
  const which = state.holding.indexOf(id) as Which | -1;
  if (which === -1) {
    return;
  }

  const back = whatGoesBack(which);
  const holding: [string, string] = which === 0 ? [back, state.holding[1]] : [state.holding[0], back];
  const displaced: [string | null, string | null] = [...state.displaced] as [string | null, string | null];
  displaced[which] = null;

  settle({ ...state, holding, displaced });
  note('bay', `${where(which)}: ${titleOf(back)} back`);
}

/**
 * A bay holding a pane that has stopped existing gets its old one back.
 *
 * Two kinds of pane come and go. A **window**'s subject leaves the list by more than one road - the player
 * closes it, a fourth window pushes the oldest off, an area is deleted out from under it. And the **choice
 * roll** goes the moment the question is answered, which is the road that mattered: the letter had taken
 * the map's bay, so without this the map never came back and the top of the stage was left empty.
 *
 * Rather than making every one of those roads remember to tidy up, the manager watches the two stores that
 * say what exists and tidies up after all of them. It asks whether the pane still exists rather than what
 * kind it is, which is what stops the next pane that comes and goes from needing a line here.
 *
 * Subscribed once, at load, and never unsubscribed: there is one bay manager for the life of the page.
 */
function tidyUp(): void {
  for (const which of [0, 1] as const) {
    if (paneById(state.holding[which]) === undefined) {
      giveBack(state.holding[which]);
    }
  }
}

watchSubjects(tidyUp);
watchGateway(tidyUp);

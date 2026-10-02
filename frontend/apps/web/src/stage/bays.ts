import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../log/log';
import type { BayName } from './bayBox';
import { MAP_PANE, NAVIGATION_PANE, type Pane, type PaneSize, SHARED_TILES, sizeAsked } from './panes';
import { type Arrangement, arrangementFor, askedIn, type Which } from './arrangement';

/**
 * The bay manager: which pane is in each bay, and which are collapsed to a strip.
 *
 * A store, the one shape every piece of state the page watches takes, read in a component through
 * `useStore`, which keeps the state out of the tree.
 *
 * It holds what is where and calls the arithmetic rather than keeping the answer, so there is exactly one
 * place that knows how the room is divided and it is a pure function with a test. See decision record 0040.
 *
 * **Nothing here survives a reload.** Which bay holds what is where the player is, not a preference they
 * set; the areas make the same choice for the same reason. What does persist - the phone toggle, the folded
 * sections - is Adam's and lives in `debug/stage.ts`.
 */

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
   *
   * A pane that takes turns in a tile with others has no entry here: its size is the tile's, below.
   */
  readonly heights: Readonly<Partial<Record<string, PaneSize>>>;
  /**
   * How big each tile its panes take turns in was asked to be, in the spread: one size for the tile,
   * whichever tab is up, by bay name. The corner is the only one.
   *
   * Per tile rather than per pane for the reason the arrangement is per fold and not per bay: how big the
   * corner is belongs to the corner, not to whatever is standing in it, so pressing a tab has nothing to
   * change. See decision record 0057.
   */
  readonly tiles: Readonly<Partial<Record<BayName, PaneSize>>>;
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
 * The map opened out with a strip beneath it: the shape the bays open on, holding what `configureBays` says -
 * the house status, in the game.
 *
 * The game is read off the map, and the house card is 200 pixels of a phone's 844 that the player has not
 * asked for yet. Pressing the strip is the first gesture there is, and it teaches the whole control.
 */
const OPENS_ON: BaysState = {
  holding: [MAP_PANE.id, NAVIGATION_PANE.id],
  arrangement: 'secondAway',
  displaced: [null, null],
  showing: {},
  heights: {},
  tiles: {},
};

const store = createStore<BaysState>(OPENS_ON);

/**
 * What the manager is told by whatever puts the game on the stage, once, from `main.tsx`: the panes there are,
 * which it checks a pane against before it puts it anywhere; being told when that may have changed; and what
 * the two bays hold when the page opens. The stage reads nothing of the game itself. See `panes.tsx`.
 */
export interface BaysConfig {
  panes(): readonly Pane[];
  watch(listener: () => void): () => void;
  opensOn: readonly [string, string];
}

let config: BaysConfig = {
  panes: () => [MAP_PANE, NAVIGATION_PANE],
  watch: () => () => undefined,
  opensOn: [MAP_PANE.id, NAVIGATION_PANE.id],
};

/** Configures the manager, and starts it tidying up after panes that stop existing. Returns what stops it. */
export function configureBays(given: BaysConfig): () => void {
  config = given;
  settle({ ...store.get(), holding: [...given.opensOn] });
  return given.watch(tidyUp);
}

function paneById(id: string): Pane | undefined {
  return config.panes().find((pane) => pane.id === id);
}

/** What each bay holds and how they share the stage. */
export const baysStore: Readable<BaysState> = store;

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

/** The stage telling the manager what it made of itself. */
export function stageIs(which: 'spread' | 'bays', along: 'rows' | 'columns'): void {
  form = which;
  cutAlong = along;
}

export function formNow(): 'spread' | 'bays' {
  return form;
}

/**
 * Where the **compass** opens navigation: the bottom one on a tall phone, the right one on a wide one.
 *
 * Adam's words are "the bottom/right pane", twice, and this is literally that - the end of the stage the
 * thumb reaches, whichever way it is cut, whatever the player has swapped into it. 0043 read it as the bay
 * that is not the map's, so that the list never covered the world; the literal reading wins because a door
 * that is somewhere else depending on what you were looking at is a door you have to find. See 0047.
 */
export const NEAR_BAY: Which = 1;

/** The bay that is not the map's, which is the one a thing clicked on the map goes into. */
export function awayFromTheMap(): Which {
  return store.get().holding[0] === MAP_PANE.id ? 1 : 0;
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
  store.set(next);
}

function titleOf(id: string): string {
  return paneById(id)?.title ?? id;
}

/**
 * Which of the panes sharing a tile is up.
 *
 * The first of them until somebody presses a tab, which is why the corner opens on the house status: it is
 * declared before navigation, and what a player wants on arriving is their own house rather than a list of
 * the nowhere they have been.
 */
export function showingIn(where: BayName, sharing: readonly Pane[]): Pane {
  const chosen = store.get().showing[where];
  return sharing.find((pane) => pane.id === chosen) ?? sharing[0]!;
}

/**
 * Bring a pane to the front of the tile it shares. What pressing a tab does, and all it does: the tile's
 * size is the tile's own, so nothing here could resize it. See decision record 0057.
 */
export function show(where: BayName, id: string): void {
  if (store.get().showing[where] === id) {
    return;
  }
  settle({ ...store.get(), showing: { ...store.get().showing, [where]: id } });
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
  if (paneById(id) === undefined || store.get().holding[which] === id) {
    return;
  }

  const other: Which = which === 0 ? 1 : 0;
  const displaced = store.get().holding[which];
  const swapping = store.get().holding[other] === id;
  const holding: [string, string] = which === 0 ? [id, store.get().holding[1]] : [store.get().holding[0], id];
  if (swapping) {
    holding[other] = displaced;
  }

  settle({ ...store.get(), holding });
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
 * behind it takes whatever is left over without being asked. And a pane that takes turns in a tile with
 * others speaks for the tile, which is one size whichever of them is up: asking from any of them, or from
 * the control in the tab bar, asks the same one thing. See decision record 0057.
 */
export function askFor(id: string, size: PaneSize): void {
  const pane = paneById(id);
  if (pane === undefined) {
    return;
  }

  if (form !== 'bays') {
    const shared = SHARED_TILES[pane.spread] !== undefined;
    if (shared) {
      if (sizeAsked(pane, store.get()) === size) {
        return;
      }
      settle({ ...store.get(), tiles: { ...store.get().tiles, [pane.spread]: size } });
      note('bay', `${pane.spread === 'bottomLeft' ? 'the corner' : pane.spread} ${SAID[size]}`);
      return;
    }
    // What it is at, which is what it opens at until it has been asked for anything: asking a pane that
    // opens at its normal size for its normal size changes nothing, and says nothing.
    if (sizeAsked(pane, store.get()) === size) {
      return;
    }
    settle({ ...store.get(), heights: { ...store.get().heights, [id]: size } });
    note('bay', `${titleOf(id)} ${SAID[size]}`);
    return;
  }

  // A pane the player has not got up is in no bay, so there is no arrangement for it to name.
  const which = store.get().holding.indexOf(id) as Which | -1;
  if (which === -1) {
    return;
  }

  const how = arrangementFor(which, size);
  if (how === store.get().arrangement) {
    return;
  }

  settle({ ...store.get(), arrangement: how });
  // The whole arrangement in one line, because it is one arrangement rather than two panes that happen to
  // agree, and because the log is the instrument Adam reads. See decision record 0023.
  note('bay', ARRANGED[how]());
}

/**
 * Put away the panes on a rail that has run out of room, so that the one above them stays open.
 *
 * Written into what each asked for, in the spread, rather than drawn put away while the room is short: a
 * pane the rail put away stays put away until the player opens it, because a pane that reopened by itself
 * whenever the room changed would be the rail second-guessing whoever put the others away. Which ones is
 * `outOfRoom`'s business; see `rail.ts` and decision record 0058.
 */
export function putAwayForRoom(ids: readonly string[]): void {
  const now = ids.filter((id) => store.get().heights[id] !== 'strip' && paneById(id) !== undefined);
  if (form !== 'spread' || now.length === 0) {
    return;
  }
  const heights = { ...store.get().heights };
  for (const id of now) {
    heights[id] = 'strip';
  }
  settle({ ...store.get(), heights });
  note('bay', `the rail is out of room: ${now.map(titleOf).join(' and ')} put away, the one above kept open`);
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
  if (askedIn(store.get().arrangement, which) !== 'strip') {
    return;
  }
  settle({ ...store.get(), arrangement: 'halfEach' });
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
  if (store.get().holding[which] === id) {
    return;
  }

  const other: Which = which === 0 ? 1 : 0;
  const was = store.get().holding[which];
  const holding: [string, string] = which === 0 ? [id, store.get().holding[1]] : [store.get().holding[0], id];
  // Taking over a bay with something that is standing in the *other* one is a swap, as putting it there
  // by hand is: with two bays there is nowhere else for the displaced pane to go, and without this both
  // bays end up holding the same pane. Reachable from one gesture - put navigation top from its own list,
  // then press the compass, which opens it at the bottom.
  if (store.get().holding[other] === id) {
    holding[other] = was;
  }
  const displaced: [string | null, string | null] = [...store.get().displaced] as [
    string | null,
    string | null,
  ];
  displaced[which] = was;

  settle({ ...store.get(), holding, displaced });
  note('bay', `${where(which)}: ${titleOf(id)}, over ${titleOf(was)}`);
}

/**
 * What goes back into a bay when whatever is in it leaves.
 *
 * What it displaced, or - if that has since gone, or it displaced nothing - whichever of the two panes the
 * bays open on is not already up: the map and the house status, in the game. A bay is never empty.
 */
function whatGoesBack(which: Which): string {
  const other: Which = which === 0 ? 1 : 0;
  const remembered = store.get().displaced[which];
  return remembered !== null &&
    remembered !== store.get().holding[other] &&
    paneById(remembered) !== undefined
    ? remembered
    : store.get().holding[other] === config.opensOn[0]
      ? config.opensOn[1]
      : config.opensOn[0];
}

/**
 * Put back whatever a pane took the place of, if it took anyone's place.
 *
 * Called as a window closes. A pane that is in no bay, or that the player put there themselves, leaves
 * nothing to put back and this does nothing.
 */
export function giveBack(id: string): void {
  const which = store.get().holding.indexOf(id) as Which | -1;
  if (which === -1) {
    return;
  }

  const back = whatGoesBack(which);
  const holding: [string, string] =
    which === 0 ? [back, store.get().holding[1]] : [store.get().holding[0], back];
  const displaced: [string | null, string | null] = [...store.get().displaced] as [
    string | null,
    string | null,
  ];
  displaced[which] = null;

  settle({ ...store.get(), holding, displaced });
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
 * Rather than making every one of those roads remember to tidy up, the manager is told whenever what exists
 * may have changed and tidies up after all of them. It asks whether the pane still exists rather than what
 * kind it is, which is what stops the next pane that comes and goes from needing a line here.
 *
 * Started by `configureBays`, once: there is one bay manager for the life of the page.
 */
function tidyUp(): void {
  for (const which of [0, 1] as const) {
    if (paneById(store.get().holding[which]) === undefined) {
      giveBack(store.get().holding[which]);
    }
  }
}

import { note } from '../debug/log';
import { watchSubjects } from '../inspect/subjects';
import type { Asking, BayName } from './bayBox';
import { askingOf, HOUSE_PANE, MAP_PANE, type Pane, paneById } from './panes';

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

export interface BaysState {
  /** The pane in each bay, by id. */
  readonly holding: readonly [string, string];
  /** The ids of panes collapsed to a strip. A pane keeps this wherever it is put. */
  readonly minimised: ReadonlySet<string>;
  /**
   * What each bay was showing before something took it over, so that closing the thing puts it back.
   *
   * Only a takeover is remembered. A pane the player chose from the kebab is a thing they asked for, and
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

/** The map above and the house beneath it: the shape the bays open on. */
const OPENS_ON: BaysState = {
  holding: [MAP_PANE.id, HOUSE_PANE.id],
  minimised: new Set(),
  displaced: [null, null],
  showing: {},
};

let state: BaysState = OPENS_ON;
/**
 * What each bay is asking for, worked out once per change rather than on every read.
 *
 * `useSyncExternalStore` compares what the store hands back by identity, so a getter that builds a fresh
 * array each time it is called is an infinite render. It is derived from the state and it changes exactly
 * when the state does, so it is cached beside it.
 */
let asking: readonly [Asking, Asking] = askingFor(OPENS_ON);
const listeners = new Set<() => void>();

function askingFor(from: BaysState): readonly [Asking, Asking] {
  const [head, tail] = from.holding;
  return [
    askingOf(paneById(head), from.minimised.has(head)),
    askingOf(paneById(tail), from.minimised.has(tail)),
  ];
}

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

/** What the player would call a bay, given how the stage is cut. */
export function where(which: Which): string {
  if (cutAlong === 'rows') {
    return which === 0 ? 'top' : 'bottom';
  }
  return which === 0 ? 'left' : 'right';
}

function settle(next: BaysState): void {
  state = next;
  asking = askingFor(next);
  for (const listener of listeners) {
    listener();
  }
}

function titleOf(id: string): string {
  return paneById(id)?.title ?? id;
}

/** What each bay is asking the layout for, which is decided by what each is holding. */
export function askingNow(): readonly [Asking, Asking] {
  return asking;
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
 * bay empty. This is what the kebab's arrows do, and it is a thing the player asked for, so nothing is
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

/** Collapse a pane to its strip, or open it back up. A pane with no strip cannot be collapsed. */
export function toggleMinimise(id: string): void {
  const pane = paneById(id);
  if (pane === undefined || pane.strip === null) {
    return;
  }

  const minimised = new Set(state.minimised);
  const shutting = !minimised.has(id);
  if (shutting) {
    minimised.add(id);
  } else {
    minimised.delete(id);
  }

  settle({ ...state, minimised });
  note('bay', `${titleOf(id)} ${shutting ? 'minimised' : 'opened back up'}`);
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

  const was = state.holding[which];
  const holding: [string, string] = which === 0 ? [id, state.holding[1]] : [state.holding[0], id];
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
export function giveBack(id: string): void {
  const which = state.holding.indexOf(id) as Which | -1;
  if (which === -1) {
    return;
  }

  const other: Which = which === 0 ? 1 : 0;
  // What it displaced, or - if that has since gone, or it displaced nothing - whichever of the two fixed
  // panes is not already up. A bay is never empty.
  const remembered = state.displaced[which];
  const back =
    remembered !== null && remembered !== state.holding[other] && paneById(remembered) !== undefined
      ? remembered
      : state.holding[other] === MAP_PANE.id
        ? HOUSE_PANE.id
        : MAP_PANE.id;

  const holding: [string, string] = which === 0 ? [back, state.holding[1]] : [state.holding[0], back];
  const displaced: [string | null, string | null] = [...state.displaced] as [string | null, string | null];
  displaced[which] = null;

  settle({ ...state, holding, displaced });
  note('bay', `${where(which)}: ${titleOf(back)} back`);
}

/**
 * A bay holding a window whose subject has gone gets its old pane back.
 *
 * A subject leaves the list by more than one road - the player closes it, a fourth window pushes the oldest
 * off, an area is deleted out from under it - and a bay left holding a pane that no longer exists is a
 * bay with nothing in it. Rather than making every one of those roads remember to tidy up, the manager
 * watches the store and tidies up after all of them.
 *
 * Subscribed once, at load, and never unsubscribed: there is one bay manager for the life of the page.
 */
watchSubjects(() => {
  for (const which of [0, 1] as const) {
    if (state.holding[which].startsWith('inspect:') && paneById(state.holding[which]) === undefined) {
      giveBack(state.holding[which]);
    }
  }
});

import { note } from '../debug/log';
import { watchSubjects } from '../inspect/subjects';
import type { Asking } from './paneBox';
import { askingOf, HOUSE_VIEW, MAP_VIEW, viewById } from './views';

/**
 * The pane manager: which view is in each pane, and which are collapsed to a strip.
 *
 * A module with a listener set rather than a context, the same shape as the gateway, the selection, the
 * areas and the debug log, because that is what `useSyncExternalStore` wants and it keeps the state out of
 * the tree.
 *
 * It holds what is where and calls the arithmetic rather than keeping the answer, so there is exactly one
 * place that knows how the room is divided and it is a pure function with a test. See decision record 0040.
 *
 * **Nothing here survives a reload.** Which pane holds what is where the player is, not a preference they
 * set; the areas make the same choice for the same reason. What does persist - the phone toggle, the folded
 * sections - is Adam's and lives in `debug/stage.ts`.
 */

/** Which of the two. `0` is the top or the left, `1` is the bottom or the right. */
export type Which = 0 | 1;

export interface PanesState {
  /** The view in each pane, by id. */
  readonly holding: readonly [string, string];
  /** The ids of views collapsed to a strip. A view keeps this wherever it is put. */
  readonly minimised: ReadonlySet<string>;
  /**
   * What each pane was showing before something took it over, so that closing the thing puts it back.
   *
   * Only a takeover is remembered. A view the player chose from the kebab is a thing they asked for, and
   * undoing it later would be the interface second-guessing them.
   */
  readonly displaced: readonly [string | null, string | null];
}

/** The map above and the house beneath it: the shape the panes open on. */
const OPENS_ON: PanesState = {
  holding: [MAP_VIEW.id, HOUSE_VIEW.id],
  minimised: new Set(),
  displaced: [null, null],
};

let state: PanesState = OPENS_ON;
/**
 * What each pane is asking for, worked out once per change rather than on every read.
 *
 * `useSyncExternalStore` compares what the store hands back by identity, so a getter that builds a fresh
 * array each time it is called is an infinite render. It is derived from the state and it changes exactly
 * when the state does, so it is cached beside it.
 */
let asking: readonly [Asking, Asking] = askingFor(OPENS_ON);
const listeners = new Set<() => void>();

function askingFor(from: PanesState): readonly [Asking, Asking] {
  const [head, tail] = from.holding;
  return [
    askingOf(viewById(head), from.minimised.has(head)),
    askingOf(viewById(tail), from.minimised.has(tail)),
  ];
}

/**
 * What the stage made of itself last time it laid out.
 *
 * Not part of the state: it is the layout's answer, not the manager's, and it changes on every resize. The
 * stage hands it back so that a line of the log reads the way Adam would say it out loud, and so that the
 * manager can tell whether putting a window somewhere means anything - in the spread there are no panes to
 * put it in.
 */
let cutAlong: 'rows' | 'columns' = 'rows';
let form: 'spread' | 'panes' = 'spread';

export function panesNow(): PanesState {
  return state;
}

export function watchPanes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The stage telling the manager what it made of itself. */
export function stageIs(which: 'spread' | 'panes', along: 'rows' | 'columns'): void {
  form = which;
  cutAlong = along;
}

export function formNow(): 'spread' | 'panes' {
  return form;
}

/** The pane that is not the map's, which is the one a thing clicked on the map goes into. */
export function awayFromTheMap(): Which {
  return state.holding[0] === MAP_VIEW.id ? 1 : 0;
}

/** What the player would call a pane, given how the stage is cut. */
export function where(which: Which): string {
  if (cutAlong === 'rows') {
    return which === 0 ? 'top' : 'bottom';
  }
  return which === 0 ? 'left' : 'right';
}

function settle(next: PanesState): void {
  state = next;
  asking = askingFor(next);
  for (const listener of listeners) {
    listener();
  }
}

function titleOf(id: string): string {
  return viewById(id)?.title ?? id;
}

/** What each pane is asking the layout for, which is decided by what each is holding. */
export function askingNow(): readonly [Asking, Asking] {
  return asking;
}

/**
 * Put a view in a pane.
 *
 * A view is in one pane or neither, never both, so putting one where the other pane already has it is a
 * **swap**: with two panes there is nowhere else for the displaced one to go, and dropping it would leave a
 * pane empty. This is what the kebab's arrows do, and it is a thing the player asked for, so nothing is
 * remembered to be put back afterwards.
 */
export function put(which: Which, id: string): void {
  if (viewById(id) === undefined || state.holding[which] === id) {
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
    'pane',
    swapping
      ? `${titleOf(id)} and ${titleOf(displaced)} swapped, ${titleOf(id)} now ${where(which)}`
      : `${where(which)}: ${titleOf(id)}, was ${titleOf(displaced)}`,
  );
}

/** Collapse a view to its strip, or open it back up. A view with no strip cannot be collapsed. */
export function toggleMinimise(id: string): void {
  const view = viewById(id);
  if (view === undefined || view.strip === null) {
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
  note('pane', `${titleOf(id)} ${shutting ? 'minimised' : 'opened back up'}`);
}

/**
 * Something taking a pane over, rather than the player choosing to put it there.
 *
 * A thing clicked on the map lands in the pane that is not the map's, and what was there is remembered so
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
  note('pane', `${where(which)}: ${titleOf(id)}, over ${titleOf(was)}`);
}

/**
 * Put back whatever a view took the place of, if it took anyone's place.
 *
 * Called as a window closes. A view that is in no pane, or that the player put there themselves, leaves
 * nothing to put back and this does nothing.
 */
export function giveBack(id: string): void {
  const which = state.holding.indexOf(id) as Which | -1;
  if (which === -1) {
    return;
  }

  const other: Which = which === 0 ? 1 : 0;
  // What it displaced, or - if that has since gone, or it displaced nothing - whichever of the two fixed
  // views is not already up. A pane is never empty.
  const remembered = state.displaced[which];
  const back =
    remembered !== null && remembered !== state.holding[other] && viewById(remembered) !== undefined
      ? remembered
      : state.holding[other] === MAP_VIEW.id
        ? HOUSE_VIEW.id
        : MAP_VIEW.id;

  const holding: [string, string] = which === 0 ? [back, state.holding[1]] : [state.holding[0], back];
  const displaced: [string | null, string | null] = [...state.displaced] as [string | null, string | null];
  displaced[which] = null;

  settle({ ...state, holding, displaced });
  note('pane', `${where(which)}: ${titleOf(back)} back`);
}

/**
 * A pane holding a window whose subject has gone gets its old view back.
 *
 * A subject leaves the list by more than one road - the player closes it, a fourth window pushes the oldest
 * off, an area is deleted out from under it - and a pane left holding a view that no longer exists is a
 * pane with nothing in it. Rather than making every one of those roads remember to tidy up, the manager
 * watches the store and tidies up after all of them.
 *
 * Subscribed once, at load, and never unsubscribed: there is one pane manager for the life of the page.
 */
watchSubjects(() => {
  for (const which of [0, 1] as const) {
    if (state.holding[which].startsWith('inspect:') && viewById(state.holding[which]) === undefined) {
      giveBack(state.holding[which]);
    }
  }
});

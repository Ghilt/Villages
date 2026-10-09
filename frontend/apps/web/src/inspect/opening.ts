import { arrive } from '../stage/arrive';
import { baysStore, askFor, formNow, giveBack } from '../stage/bays';
import type { PaneSize, Room } from '../stage/panes';
import { closeOne, openOn, paneIdOf, type Subject } from './subjects';

/**
 * Opening and closing an inspect window, and where it lands.
 *
 * The policy that joins the subject store to the bay manager, and the only place that knows either of
 * them has anything to do with the other. Both are dumb on purpose: the store says what is open, the
 * manager says what is where, and what *should* happen when a player clicks a castle is neither's business.
 *
 * In the spread nothing is placed. Everything is on screen at once, so a new window joins the rail and no
 * bay changes; that is the whole difference between the forms. See decision record 0040.
 */

/**
 * Open a window on something.
 *
 * In the bays it takes **the top**, in the map's place or the window's that was there, because the top of a
 * phone is the map or one window: Adam's word of 2026-10-08. Closing it gives the map back. And it opens the
 * top to at least half if it was a strip, because a window nobody can read is not an answer to a click. See
 * `phone.ts` and decision records 0046 and 0109.
 */
export function inspect(subject: Subject): void {
  openOn(subject);
  // In the spread a window asked for again comes to the top of the rail, and one that was put away opens,
  // because a thing nobody can read is not an answer to a click. See decision record 0058.
  arrive(paneIdOf(subject), { inTheSpread: 'full' });
}

/**
 * Open a window on something from a pane: what a window's links do, and a line of a dialogue that shows a house
 * or a person. On a phone it goes on top, as any window does.
 */
export function inspectBeside(subject: Subject, from: Room): void {
  openOn(subject);
  from.openBeside(paneIdOf(subject));
}

/**
 * A window's own size control.
 *
 * In the spread, opening a window that was put away brings it to the top of the rail, as asking for it
 * from the map does - so the window opened, the one on top and the one the map rings are always the same,
 * and a rail out of room keeps it open and puts the others away. Adam's pick, over opening where it
 * stood. Anything else is the size and nothing more. See decision record 0058.
 */
export function sizeWindow(subject: Subject, size: PaneSize): void {
  if (formNow() === 'spread' && size !== 'strip' && isPutAway(subject)) {
    openOn(subject);
  }
  askFor(paneIdOf(subject), size);
}

/** Whether a window is put away in the spread, where each window's size is its own. */
function isPutAway(subject: Subject): boolean {
  return baysStore.get().heights[paneIdOf(subject)] === 'strip';
}

/** Close a window, and give its bay back to whatever it took over. */
export function stopInspecting(subject: Subject): void {
  giveBack(paneIdOf(subject));
  closeOne(subject);
}

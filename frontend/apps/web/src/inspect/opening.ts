import { baysStore, askFor, awayFromTheMap, formNow, giveBack, roomToRead, takeOver } from '../stage/bays';
import { type Which } from '../stage/arrangement';
import type { PaneSize } from '../stage/panes';
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
 * In the bays it takes **the bay that is not the map's**, unless the player pointed at one with the
 * arrows - because the thing they clicked is on the map, and putting the window over the map would hide
 * what they just asked about. Closing it puts back whatever was there.
 *
 * And it opens the bay to at least half if it was a strip, because a window nobody can read is not an
 * answer to a click. That is the arrival's business rather than the manager's: the compass lands in a
 * strip quite happily, and the difference between the two is who asked. See decision record 0046.
 */
export function inspect(subject: Subject, into: Which | null = null): void {
  openOn(subject);

  if (formNow() !== 'bays') {
    // In the spread a window asked for again comes to the top of the rail, and one that was put away opens,
    // because a thing nobody can read is not an answer to a click. See decision record 0058.
    if (isPutAway(subject)) {
      askFor(paneIdOf(subject), 'full');
    }
    return;
  }
  const bay = into ?? awayFromTheMap();
  takeOver(bay, paneIdOf(subject));
  roomToRead(bay);
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

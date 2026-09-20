import { awayFromTheMap, formNow, giveBack, roomToRead, takeOver, type Which } from '../stage/bays';
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
    return;
  }
  const bay = into ?? awayFromTheMap();
  takeOver(bay, paneIdOf(subject));
  roomToRead(bay);
}

/** Close a window, and give its bay back to whatever it took over. */
export function stopInspecting(subject: Subject): void {
  giveBack(paneIdOf(subject));
  closeOne(subject);
}

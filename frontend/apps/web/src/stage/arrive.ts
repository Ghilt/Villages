import type { Which } from './arrangement';
import {
  askFor,
  awayFromTheMap,
  baysStore,
  formNow,
  paneById,
  put,
  roomToRead,
  show,
  takeOver,
  theMapsBay,
} from './bays';
import { MAP_PANE, type PaneSize, SHARED_TILES, sizeAsked } from './panes';

/**
 * Something arriving on the stage - a window asked for, a dialogue offered, a question asked - and the map shown
 * beside a pane, which are the one policy written once. See decision records 0044 and 0046.
 *
 * On a phone a thing that arrives takes a bay: the one the map is not in, so that what was clicked on the map
 * is still in view, or the map's own when reading it is the thing to do first, as a question is. What it
 * displaced comes back when it goes. And it opens that bay to at least half, because a thing that arrives as
 * a strip is a thing nobody can read; who asked is the difference between this and the compass, which lands
 * in a strip quite happily. A thing already standing in a bay stays there, unless it was pointed at the other.
 * In the spread everything is on the screen at once, so nothing is placed, and a thing that was put away
 * there comes back at the size it says.
 */

export interface Arrival {
  /** Which bay it takes on a phone: the one the map is not in, unless it says otherwise. */
  into?: Which | 'theMapsBay';
  /** What it opens to in the spread if it was put away there. Absent, and it is left as it stands. */
  inTheSpread?: PaneSize;
}

export function arrive(id: string, how: Arrival = {}): void {
  if (formNow() !== 'bays') {
    const pane = paneById(id);
    if (how.inTheSpread !== undefined && pane !== undefined && sizeAsked(pane, baysStore.get()) === 'strip') {
      askFor(id, how.inTheSpread);
    }
    // In a tile it takes turns in, what arrives comes to the front of it: a quest offered beside a dialogue.
    if (pane !== undefined && SHARED_TILES[pane.spread] !== undefined) {
      show(pane.spread, id);
    }
    return;
  }
  // Already standing in a bay, and not pointed at another: it stays where it is and that bay opens to be read.
  // Take action is pressed in the letter, and the hand it rolls arrives in the letter; taking the map's bay
  // swapped the two at every press, Adam's find of 2026-10-06.
  const standing = baysStore.get().holding.indexOf(id);
  if (standing !== -1 && typeof how.into !== 'number') {
    roomToRead(standing as Which);
    return;
  }
  const bay = how.into === 'theMapsBay' ? theMapsBay() : (how.into ?? awayFromTheMap());
  takeOver(bay, id);
  roomToRead(bay);
}

/** The bay beside the one a pane is in, on a phone; null in the spread, and for a pane in no bay. */
function besideOf(id: string): Which | null {
  if (formNow() !== 'bays') {
    return null;
  }
  const at = baysStore.get().holding.indexOf(id);
  return at === -1 ? null : at === 0 ? 1 : 0;
}

/**
 * The map, beside the pane that asked, opened to be read: what a window's link to the map does, and a key
 * figure shown where they stand, and a place a line of a dialogue shows. In the spread the map is the floor
 * and is already there. See decision record 0049.
 */
export function showMapBeside(asking: string): void {
  const there = besideOf(asking);
  if (there !== null) {
    put(there, MAP_PANE.id);
    roomToRead(there);
  }
}

/**
 * A pane arriving beside the one that asked: in the other bay on a phone, so that the two stay side by side,
 * and away from the map from a pane in no bay; in the spread, opened if it was put away.
 */
export function openBeside(asking: string, id: string): void {
  arrive(id, { into: besideOf(asking) ?? undefined, inTheSpread: 'full' });
}

import { askFor, baysStore, formNow, paneById, show } from './bays';
import { type PaneSize, sharedTileOf, sizeAsked } from './panes';
import { arriveOnAPhone, showTheMap } from './phone';

/**
 * Something arriving on the stage - a window asked for, a dialogue offered, a question asked - and the map shown
 * beside a pane, which are the one policy written once. See decision records 0044, 0046 and 0109.
 *
 * On a phone a thing that arrives takes the bay it stands in: a window the top, in the map's place, and
 * anything else the bottom, and it opens that bay to at least half, because a thing that arrives as a strip is
 * a thing nobody can read; see `phone.ts`. In the spread everything is on the screen at once, so nothing is
 * placed, and a thing that was put away there comes back at the size it says.
 */

export interface Arrival {
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
    const shared = pane === undefined ? null : sharedTileOf(pane);
    if (shared !== null) {
      show(shared, id);
    }
    return;
  }
  arriveOnAPhone(id);
}

/**
 * The map, opened to be read: what a window's link to the map does, and a key figure shown where they stand,
 * and a place a line of a dialogue shows. On top of a phone; in the spread the map is the floor and is already
 * there. See decision record 0049.
 */
export function showMap(): void {
  if (formNow() === 'bays') {
    showTheMap();
  }
}

/**
 * A pane brought up from another: where it stands on a phone, a window on top and anything else below; in the
 * spread, opened if it was put away.
 */
export function openBeside(id: string): void {
  arrive(id, { inTheSpread: 'full' });
}

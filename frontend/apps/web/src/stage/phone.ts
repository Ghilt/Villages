import type { BarButton } from '../ui/bar/BottomBar';
import type { MarkName } from '../ui/mark/Mark';
import { askedIn, type Which } from './arrangement';
import { askFor, baysStore, paneById, put, roomToRead, takeOver } from './bays';
import type { IconName } from './Icons';
import { MAP_PANE, type Pane } from './panes';

/**
 * Where things stand on a phone: **the map or one window on top, every other pane below.** Adam's word of
 * 2026-10-08, *the top pane is either map, or inspect pane*. A pane says which with `phone`; the bay manager
 * holds what is where and knows nothing of either, and this is the one place the two meet. Nothing here ever
 * puts a pane in the other end's bay, so nothing swaps across the fold any more. See decision record 0109.
 */

/** The bay a pane stands in on a phone: the top for the map and the windows, below for everything else. */
export function bayOnAPhone(pane: Pane | undefined): Which {
  return pane?.phone === 'top' ? 0 : 1;
}

/**
 * Something arriving on a phone: a window asked for, a question asked, a dialogue offered.
 *
 * Standing in a bay already, it stays there and only that bay opens to be read. Otherwise it takes the bay it
 * stands in and opens it to half if it was a strip, because a thing that arrives as a strip is a thing nobody
 * can read. What it displaced comes back when it goes - but **a window arriving over a window takes its place
 * without being remembered** as the thing to give back, so its close gives the map back rather than the window
 * it replaced, which stays open, in no bay, and in the trail.
 */
export function arriveOnAPhone(id: string): void {
  const standing = baysStore.get().holding.indexOf(id) as Which | -1;
  if (standing !== -1) {
    roomToRead(standing);
    return;
  }
  const bay = bayOnAPhone(paneById(id));
  if (bay === 0 && baysStore.get().holding[0] !== MAP_PANE.id) {
    put(0, id);
  } else {
    takeOver(bay, id);
  }
  roomToRead(bay);
}

/**
 * The player going to a pane, from navigation: it goes where it stands, opened to be read, and nothing is
 * remembered to put back, because it is a thing they asked for. The map goes on top and takes the window's
 * place there; anything else goes below, in navigation's own place.
 */
export function goTo(id: string): void {
  const bay = bayOnAPhone(paneById(id));
  put(bay, id);
  roomToRead(bay);
}

/**
 * The map on top, opened to be read: what a window's *show it on the map* does, and a key figure shown where
 * they stand, and a place a line of a dialogue shows. The window on top, if one was, stays open, in no bay.
 */
export function showTheMap(): void {
  goTo(MAP_PANE.id);
}

/**
 * A mark of the **bottom bar** pressed: the pane it stands for goes below, opened to half if the bottom was put
 * away, and pressing the one already there - the lit one - puts the bottom away, or opens it again. Every press
 * writes the one arrangement the size control on top writes, so the two can never disagree. See decision record
 * 0109.
 */
export function pressInTheBar(id: string): void {
  const { holding, arrangement } = baysStore.get();
  if (holding[1] !== id) {
    goTo(id);
    return;
  }
  askFor(id, askedIn(arrangement, 1) === 'strip' ? 'small' : 'strip');
}

/**
 * The library's mark for each pane's own, which is what the bar draws: the same drawings, named for the pane in
 * the library where the stage names them for the picture.
 */
export const BAR_MARKS: Readonly<Partial<Record<IconName, MarkName>>> = {
  shield: 'house',
  figure: 'figures',
  tower: 'tower',
  letter: 'letter',
  speech: 'dialogues',
  quests: 'quests',
  challenges: 'challenge',
  recent: 'recent',
  settings: 'settings',
};

/**
 * The bar's marks: every pane standing below on a phone, in the order the panes are declared, a mark each and its
 * name for the pointer and a screen reader. A pane with no mark here would be left off the bar, which a test holds
 * none of the standing panes to.
 */
export function barButtons(panes: readonly Pane[]): readonly BarButton[] {
  return panes.flatMap((pane) => {
    const mark = BAR_MARKS[pane.icon];
    return bayOnAPhone(pane) === 1 && mark !== undefined ? [{ id: pane.id, label: pane.title, mark }] : [];
  });
}

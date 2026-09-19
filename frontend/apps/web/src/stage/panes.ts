import { paneIdOf, subjectOfPane, subjectsNow } from '../inspect/subjects';
import type { Subject } from '../inspect/subjects';
import type { Asking, BayName, SpreadWants } from './bayBox';
import { TAB_BAR } from './bayBox';
import type { IconName } from './Icons';

/**
 * What can occupy a bay, and what each one asks for.
 *
 * A pane is declared here and placed by the layout. Nothing in the layout knows what a map is, and no pane
 * learns which bay it is in beyond the room it was given - which is what lets a mechanic be written once
 * and drawn at up to three sizes. See decision records 0040 and 0041.
 *
 * Three of them are fixed and the rest come and go: an **inspect window** is a pane per subject, so the list
 * grows as the player opens them. Character dialogue will be another fixed one.
 */

export interface Pane {
  /** What the bay manager addresses it by, and what the debug log says. */
  id: string;
  /** What the kebab calls it, and what a minimised strip has written on it. */
  title: string;
  /** What its bay asks for when it is not minimised. */
  wants: 'big' | 'small';
  /** The pixels it needs when its bay is the small one. Unread when it wants to be big. */
  small: number;
  /** The pixels its strip is when minimised, or null when minimising it would leave nothing worth seeing. */
  strip: number | null;
  /**
   * Which tile of the spread it takes, where there is room for everything at once.
   *
   * Declared by the pane and not decided by the layout, which is what keeps the layout from knowing what a
   * map is: the bays are named for where they are, and a pane says which one it belongs in.
   */
  spread: BayName;
  /**
   * How tall its tile is in the spread. Unread by a pane that takes the floor, which is the whole stage.
   *
   * A height and not a box: the column's width is shared by everything in it, so no pane in it can be the
   * one that decides it.
   */
  tall: number;
  /** The mark it is known by where there is no room for its name, which is a tab. */
  icon: IconName;
}

export const MAP_PANE: Pane = {
  id: 'map',
  title: 'the map',
  wants: 'big',
  small: 200,
  // A strip of map is not a map. Whether the player should be able to put the world away entirely to read
  // something long is a real question and `RESPONSIVE-DESIGN.md` has it open; until then, no.
  strip: null,
  // The ground everything else stands on, rather than a tile competing with the rest for room.
  spread: 'floor',
  tall: 0,
  icon: 'map',
};

export const HOUSE_PANE: Pane = {
  id: 'house',
  title: 'your house',
  wants: 'small',
  // Enough for one line of the house and the bar of its levers beneath. The bar is 2.6rem of it.
  small: 132,
  // The name and nothing else, so the player knows where it went.
  strip: 44,
  // Into the bottom-left corner, cut off by two of the stage's own edges, as the card always was.
  spread: 'bottomLeft',
  // What the card measures with the shield, the blazon, the treasury and the bar of levers in it.
  tall: 200,
  icon: 'shield',
};

/**
 * **Navigation**: the ways from here, and the ways back.
 *
 * It shares the corner with the house status, which is what the **tab bar** is for: two panes, one tile,
 * and a strip of marks saying which is up. In the spread it is the trail and nothing else, because
 * everything a player might navigate *to* is already on the screen - the map is the floor and the house is
 * behind the other tab. On a phone it will say more, and that is its own step.
 */
export const NAVIGATION_PANE: Pane = {
  id: 'navigation',
  title: 'where you have been',
  wants: 'big',
  small: 200,
  strip: 44,
  // Beside the house, in the corner. The two of them are what makes the corner a tabbed tile at all.
  spread: 'bottomLeft',
  // The same height as the card it shares the tile with, so the column does not jump as the tab changes.
  tall: 200,
  icon: 'compass',
};

export const FIXED_PANES: readonly Pane[] = [MAP_PANE, HOUSE_PANE, NAVIGATION_PANE];

/**
 * The pane that holds a window on one subject.
 *
 * It **wants to be big**, which is what makes Adam's example come out right: the map wants to be big too,
 * so two bays asking the same thing get half each and an opened window takes half the screen with the
 * thing it is about still on the map above it.
 */
export function inspectPane(subject: Subject): Pane {
  return {
    id: paneIdOf(subject),
    title: subject.kind === 'house' ? 'a house' : 'an area',
    wants: 'big',
    small: 220,
    strip: 44,
    // Down the column, where up to three of them stack. The rail inside that one tile is what limits how
    // many, so a window asks the column for no height of its own.
    spread: 'left',
    tall: 0,
    icon: 'window',
  };
}

/** The panes that share one tile of the spread, in the order they were declared. */
export function panesIn(panes: readonly Pane[], where: BayName): readonly Pane[] {
  return panes.filter((pane) => pane.spread === where);
}

/**
 * What the spread's tiles are asked for, worked out from the panes that declared they sit in them.
 *
 * A minimised pane asks for its strip here exactly as it does in the bays form, which is what makes
 * **minimise work in the spread too**: putting the house away gives the column's room back to the rail,
 * and the map behind it was never competing for that room in the first place. See decision record 0040.
 *
 * A tile nobody declared is `null` and is not laid out at all. That is the difference between an empty
 * tile and a small one: with no choice pending, the map runs clean to the bottom edge of the stage.
 */
export function spreadWants(
  panes: readonly Pane[],
  minimised: ReadonlySet<string>,
  showing: (where: BayName, sharing: readonly Pane[]) => Pane,
): SpreadWants {
  const tallOf = (where: BayName): number | null => {
    const sharing = panesIn(panes, where);
    if (sharing.length === 0) {
      return null;
    }
    // The tile is as tall as the pane that is up, not as the tallest of them: a tab that is not showing is
    // not taking any room, and the tile would otherwise be sized by something nobody can see.
    const pane = showing(where, sharing);
    const tall = minimised.has(pane.id) && pane.strip !== null ? pane.strip : pane.tall;
    return tall + (sharing.length > 1 ? TAB_BAR : 0);
  };

  return {
    left: panes.some((pane) => pane.spread === 'left'),
    bottomLeft: tallOf('bottomLeft'),
    bottomMiddle: tallOf('bottomMiddle'),
  };
}

/**
 * Every pane there is: the two fixed ones, then a window per subject, newest first.
 *
 * Takes the subjects rather than reading them, so that it is pure and a component can memoise it against
 * exactly what it depends on.
 */
export function panesFor(open: readonly Subject[]): readonly Pane[] {
  return [...FIXED_PANES, ...open.map(inspectPane)];
}

/** The same, for callers outside a render that have no subjects in hand. */
export function panesNow(): readonly Pane[] {
  return panesFor(subjectsNow().open);
}

export function paneById(id: string): Pane | undefined {
  const fixed = FIXED_PANES.find((pane) => pane.id === id);
  if (fixed !== undefined) {
    return fixed;
  }
  const subject = subjectOfPane(id);
  // Built rather than looked up: a window's pane is a description of its subject, and the subject store is
  // the only place that knows whether it is still open.
  return subject !== null && subjectsNow().open.some((one) => paneIdOf(one) === id)
    ? inspectPane(subject)
    : undefined;
}

/** The three sizes a pane can be drawn at. Not every pane has all three. */
export type PaneSize = 'full' | 'small' | 'strip';

/** What a pane is handed: the room it got, and the way to give it back. Nothing about which bay it is in. */
export interface Room {
  size: PaneSize;
  /** Collapse to a strip, or open back up. Null when this pane has no strip to collapse to. */
  minimise: (() => void) | null;
}

/**
 * What a bay holding this pane asks the layout for.
 *
 * Minimising is not a case the arithmetic knows about: a minimised pane asks for a smaller number than a
 * small one does, and that is the whole of it. A pane that cannot be minimised asks for what it wanted.
 */
export function askingOf(pane: Pane | undefined, minimised: boolean): Asking {
  if (pane === undefined) {
    return 'big';
  }
  if (minimised && pane.strip !== null) {
    return { small: pane.strip };
  }
  return pane.wants === 'small' ? { small: pane.small } : 'big';
}

/**
 * How big a pane draws itself, given the form, what its bay asked for and whether it is collapsed.
 *
 * In the spread everything is full, because nothing is competing for the room: a pane asks to be small so
 * that the *other* bay can have the rest, and in the spread there is no other bay. That is why the house
 * card in the corner is the same card it always was, and only a phone ever sees the small one.
 */
export function sizeOf(form: 'spread' | 'bays', asking: Asking, minimised: boolean): PaneSize {
  if (minimised) {
    return 'strip';
  }
  if (form === 'spread') {
    return 'full';
  }
  return typeof asking === 'object' ? 'small' : 'full';
}

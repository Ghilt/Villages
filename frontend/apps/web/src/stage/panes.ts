import { gatewayState } from '../net/gateway';
import { paneIdOf, subjectOfPane, subjectsNow } from '../inspect/subjects';
import type { Subject } from '../inspect/subjects';
import type { BayName, SpreadWants } from './bayBox';
import { isTabbed, STRIP, TAB_BAR } from './bayBox';
import type { IconName } from './Icons';

/**
 * What can occupy a bay, and what each one asks for.
 *
 * A pane is declared here and placed by the layout. Nothing in the layout knows what a map is, and no pane
 * learns which bay it is in beyond the room it was given - which is what lets a mechanic be written once
 * and drawn at three sizes. See decision records 0040 and 0041.
 *
 * **What a pane declares is the spread's business only.** On a phone the three sizes are a strip, half the
 * stage and the rest, the same three for every pane, and which of the three arrangements the stage is in
 * belongs to the fold rather than to anything standing in it. So the numbers here are tile heights and
 * nothing else. See decision record 0046.
 *
 * Three of them are fixed and the rest come and go: an **inspect window** is a pane per subject, so the list
 * grows as the player opens them. Character dialogue will be another fixed one.
 */

export interface Pane {
  /** What the bay manager addresses it by, and what the debug log says. */
  id: string;
  /** What **navigation** and a tab's label call it, and what a minimised strip has written on it. */
  title: string;
  /**
   * Which tile of the spread it takes, where there is room for everything at once.
   *
   * Declared by the pane and not decided by the layout, which is what keeps the layout from knowing what a
   * map is: the bays are named for where they are, and a pane says which one it belongs in.
   */
  spread: BayName;
  /**
   * How tall its tile is in the spread, at each size it is drawn at. Null for a pane with no tile of its
   * own, which is the map on the floor and a window in the rail.
   *
   * **The spread's numbers, and only the spread's.** A bay on a phone is one end of a stage two panes are
   * sharing, and how much of it each gets is the fold's business rather than either pane's - see
   * `Arrangement` in `bays.ts`. A tile here is not dividing anything with anybody: the map behind it takes
   * whatever is left over without being asked, so its height is its own. That is why these are the only
   * numbers left on a pane, where there were three.
   *
   * The strip is not among them, because a strip is one thickness for every pane and it is {@link STRIP}.
   *
   * A height and not a box: the column's width is shared by everything in it, so no pane in it can be the
   * one that decides it.
   */
  tall: { full: number; small: number } | null;
  /** The mark it is known by where there is no room for its name, which is a tab. */
  icon: IconName;
  /**
   * The room its **full** form needs: a bay at least this **wide**, so the contents sit side by side, *or*
   * at least this **tall**, so they sit one under another. Neither, and the pane is handed its small size.
   *
   * Null for a pane whose full form fits wherever it is put. Two numbers and not one because a phone is
   * narrow and long while a tile along the bottom is wide and short, and the same list is at home in both -
   * it is only a bay that is neither that has no room for it.
   *
   * This is how "a tile that runs out of room draws itself smaller" stops being a hope. The layout knows
   * every bay's rectangle, so it hands back the size that fits rather than leaving the pane to grow a
   * scrollbar. See decision record 0044.
   */
  needs: { wide: number; tall: number } | null;
}

export const MAP_PANE: Pane = {
  id: 'map',
  title: 'the map',
  // The ground everything else stands on, rather than a tile competing with the rest for room.
  spread: 'floor',
  // The floor is the whole stage and asks the column for nothing.
  tall: null,
  icon: 'map',
  needs: null,
};

export const HOUSE_PANE: Pane = {
  id: 'house',
  title: 'your house',
  // Into the bottom-left corner, cut off by two of the stage's own edges, as the card always was.
  spread: 'bottomLeft',
  // Full is what the card measures with the shield, the blazon, the treasury and the bar of levers in it;
  // small is one line of the house and the bar beneath, of which the bar is 2.6rem.
  tall: { full: 200, small: 132 },
  icon: 'shield',
  needs: null,
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
  // What it is *for* rather than what is in it. A player who pressed a compass is going somewhere;
  // "where you have been" is the trail, which is only the lower half of what it offers.
  title: 'go to',
  // Beside the house, in the corner. The two of them are what makes the corner a tabbed tile at all.
  spread: 'bottomLeft',
  // The same height as the card it shares the tile with, and the same at both sizes, so the column does
  // not jump as the tab changes or as the trail is opened out.
  tall: { full: 200, small: 200 },
  icon: 'compass',
  needs: null,
};

/**
 * **The choice roll**: what the world is asking, and the options it is offering.
 *
 * The one pane that is not always there. It arrives when the world asks something and goes when the
 * question is answered, which is why it is not one of the fixed ones - and why an empty `bottomMiddle` tile
 * takes no room at all, so with nothing pending the map runs clean to the bottom of the stage.
 *
 * Full is the options laid out to read through; small is the **carousel**, one option at a time, for
 * glancing at them while looking at the map they are about; minimised is the letter set aside. It was the
 * one pane whose size was the **player's** rather than the layout's, and since 0046 every pane's is: a
 * phone's three arrangements are the player's to pick and nobody's to derive. See `MECHANICS.md` and
 * decision records 0044 and 0046.
 */
export const CHOICE_PANE: Pane = {
  id: 'choice',
  title: 'a letter',
  spread: 'bottomMiddle',
  // The same at both sizes, because a tile too narrow for three across draws the carousel in it and the
  // tile's height does not change when that happens. Measured against the founding choice's wordiest
  // option rather than picked, because an option that does not fit grows a scrollbar inside a sheet of
  // parchment, which is not what parchment does.
  tall: { full: 224, small: 224 },
  icon: 'letter',
  // Three options across a wide tile, or three down a tall bay. A bay that is neither - the bottom middle
  // of a small spread - gets the carousel, which is the whole answer to a row that has run out of room:
  // the pane draws itself smaller, and the form does not change because a tile got tight.
  needs: { wide: 544, tall: 460 },
};

export const FIXED_PANES: readonly Pane[] = [MAP_PANE, HOUSE_PANE, NAVIGATION_PANE];

/**
 * The panes that are not a window on a subject: the fixed three, and the choice roll while one is pending.
 *
 * What **navigation** lists under *Go to*, and what the layout places besides the rail. A window is not
 * here because a window is in the **trail** instead, under its own name rather than as "a house".
 */
export function standingPanes(pending: boolean): readonly Pane[] {
  return pending ? [...FIXED_PANES, CHOICE_PANE] : FIXED_PANES;
}

/**
 * The pane that holds a window on one subject.
 *
 * On a phone it arrives at **half the stage**, which is what makes Adam's example come out right: the
 * thing that was clicked is still on the map above it. That is the arrival's doing rather than the pane's
 * - see `roomToRead` in `bays.ts` - because since 0046 a pane has nothing to say about how much of a bay
 * it gets.
 */
export function inspectPane(subject: Subject): Pane {
  return {
    id: paneIdOf(subject),
    title: subject.kind === 'house' ? 'a house' : 'an area',
    // Down the column, where up to three of them stack. The rail inside that one tile is what limits how
    // many, so a window asks the column for no height of its own.
    spread: 'left',
    tall: null,
    icon: 'window',
    needs: null,
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
  heights: Readonly<Partial<Record<string, PaneSize>>>,
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
    // A tile's three heights, which is what the control means on a desktop: put away, the normal card, and
    // opened out. Full is the default here, because a tile is the size the pane asked for rather than a
    // share of a stage it is dividing with somebody.
    const size = heights[pane.id] ?? 'full';
    const tall = size === 'strip' ? STRIP : (pane.tall?.[size] ?? 0);
    return tall + (isTabbed(where, sharing.length) ? TAB_BAR : 0);
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
export function panesFor(open: readonly Subject[], pending: boolean): readonly Pane[] {
  return [...standingPanes(pending), ...open.map(inspectPane)];
}

/** The same, for callers outside a render, which read the two stores themselves. */
export function panesNow(): readonly Pane[] {
  return panesFor(subjectsNow().open, gatewayState().yourChoice !== null);
}

export function paneById(id: string): Pane | undefined {
  const standing = panesNow().find((pane) => pane.id === id && !pane.id.startsWith('inspect:'));
  if (standing !== undefined) {
    return standing;
  }
  const subject = subjectOfPane(id);
  // Built rather than looked up: a window's pane is a description of its subject, and the subject store is
  // the only place that knows whether it is still open.
  return subject !== null && subjectsNow().open.some((one) => paneIdOf(one) === id)
    ? inspectPane(subject)
    : undefined;
}

/**
 * The three sizes a pane is drawn at: put away, the normal one, and opened out.
 *
 * **Every pane has all three, and the player picks.** They need not be three different drawings - a pane
 * whose full form is a list can draw the same list small and simply show less of it, and the choice roll
 * is the one that genuinely draws something else, which is the carousel. What they have in common is that
 * the pane owns all three and the layout only says how much room there is. See decision record 0045.
 */
export type PaneSize = 'full' | 'small' | 'strip';

/** The three, smallest first, which is the order the control offers them in. */
export const SIZES: readonly PaneSize[] = ['strip', 'small', 'full'];

/** What a pane is handed: the room it got, and the way to ask for another. Nothing about which bay. */
export interface Room {
  /** The size it is actually drawn at: what was asked for, capped by what the bay can hold. */
  size: PaneSize;
  /**
   * The size that was **asked for**, which is what the control marks.
   *
   * Not the same as {@link size} when the bay is too small to hold what was wanted. The control has to
   * mark the wish rather than the outcome, or pressing "opened out" on a pane the bay is capping would
   * change nothing visible and leave the mark sitting on the wrong one.
   */
  asked: PaneSize;
  /** Ask to be drawn at one of them. */
  ask: (size: PaneSize) => void;
}

/**
 * How big a pane draws itself: what the player asked for, capped by what the bay can actually hold.
 *
 * One line, and the same in both forms, because a bay is a rectangle in both. The cap is what stops a pane
 * too big for its tile growing a scrollbar: the layout knows the room, so it hands back the size that fits
 * rather than the one that was wanted.
 */
export function sizeOf(asked: PaneSize, cramped = false): PaneSize {
  if (asked === 'strip') {
    return 'strip';
  }
  return cramped ? 'small' : asked;
}

/** Whether a bay is neither wide enough nor tall enough for the full form of the pane in it. */
export function cramps(pane: Pane | undefined, bay: { w: number; h: number } | null): boolean {
  const needs = pane?.needs;
  if (needs == null || bay === null) {
    return false;
  }
  return bay.w < needs.wide && bay.h < needs.tall;
}

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
 * Four of them are fixed and the rest come and go: an **inspect window** is a pane per subject, so the list
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
   * own: the map on the floor, a window in the rail, and a pane that takes turns in a tile with others,
   * whose tile is one size whichever of them is up - see {@link SHARED_TILES}.
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
   * one that decides it. The one exception is the corner opened out, which is the corner's own and not a
   * pane's: see {@link SharedTile}.
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

/**
 * A tile that several panes take turns in, and the sizes it has **whichever of them is up**.
 *
 * The tile's and not the tab's, which is the whole point: pressing a tab never resizes anything, because
 * the layout never learns which tab is up. It is the desktop's form of the rule the fold keeps on a phone -
 * how big the corner is belongs to the corner, not to whatever is standing in it - and it replaced a
 * height per pane that the tabs had to be kept agreeing about by hand. See decision record 0057.
 */
export interface SharedTile {
  /** How tall it is at the normal size and opened out. Put away it is a strip like any pane's, `STRIP`. */
  tall: { full: number; small: number };
  /**
   * How wide it wants to be opened out, if wider than the column: the corner reaching along the bottom,
   * where the rail above keeps the column's width and a letter along the bottom moves over. Absent, and
   * it is the column's width at every size. See decision record 0056.
   */
  openWide?: number;
  /** The size it opens at, before the player has asked for any. */
  startsAt: PaneSize;
}

/**
 * **The corner**, bottom left: one size whichever of its panes is up.
 *
 * The bay's sizes, sized for what is meant to live there rather than after whichever pane is standing in
 * it; a pane with nothing to fill the biggest with is given flavour later, and the corner does not shrink
 * to it. The numbers came from the two that needed the most. Normal is the house card's whole height -
 * the shield, the blazon, the row of five resources wrapping to two, and the bar of levers - and it is
 * what the corner opens at. Opened out is the key figures' details, the portrait beside the name and five
 * lines of stats: as tall as the corner can be and still leave the rail room for a window on the shortest
 * stage the spread is drawn on, and reaching along the bottom to 560. A test holds all of it.
 */
export const CORNER: SharedTile = { tall: { full: 340, small: 232 }, openWide: 560, startsAt: 'small' };

/**
 * The tiles whose panes take turns, and the sizes each has. A tile that two panes declare themselves into
 * and that is missing here fails a test, because its size would otherwise follow whichever tab was up.
 */
export const SHARED_TILES: Readonly<Partial<Record<BayName, SharedTile>>> = { bottomLeft: CORNER };

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
  // The corner's size rather than the card's own, and the corner's normal height is this card's full one.
  // See `CORNER`.
  tall: null,
  icon: 'shield',
  needs: null,
};

/**
 * **Key figures**: the few named people the house acts through, as a grid of their portraits.
 *
 * The corner's middle tab, between the house status and navigation, because it is the house's own and a
 * player reaches it the way they reach the house. The corner is one size whichever tab is up, so pressing
 * between them moves nothing; opened out it is taller and wider than the column, and that size is the
 * one this pane's details need, the portrait beside the name and the stats. See `CORNER`, `MECHANICS.md`
 * and decision records 0055 and 0057.
 */
export const KEY_FIGURES_PANE: Pane = {
  id: 'key-figures',
  title: 'key figures',
  spread: 'bottomLeft',
  tall: null,
  icon: 'figure',
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
  // Beside the house, in the corner, and the corner's size whichever of its tabs is up. See `CORNER`.
  spread: 'bottomLeft',
  tall: null,
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

/** In the order their tabs stand in the corner, which is the order they are declared in. */
export const FIXED_PANES: readonly Pane[] = [MAP_PANE, HOUSE_PANE, KEY_FIGURES_PANE, NAVIGATION_PANE];

/**
 * The panes that are not a window on a subject: the fixed four, and the choice roll while one is pending.
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
    title: subject.kind === 'house' ? 'a house' : subject.kind === 'area' ? 'an area' : 'a key figure',
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
 *
 * **It is not told which tab is up**, and that is what makes pressing one move nothing: a tile its panes
 * take turns in has sizes of its own, so there is nothing about the tab that the answer could depend on.
 * It used to be handed the tab and size the tile by it, and every tab then had to be kept the same height
 * by hand. See decision record 0057.
 */
export function spreadWants(panes: readonly Pane[], asked: Asked): SpreadWants {
  const tallOf = (where: BayName): number | null => {
    const sharing = panesIn(panes, where);
    const first = sharing[0];
    if (first === undefined) {
      return null;
    }
    // A tile's three heights, which is what the control means on a desktop: put away, the normal size, and
    // opened out. The first pane speaks for the tile, because in a tile its panes take turns in every one
    // of them answers with the tile's own size.
    const size = sizeAsked(first, asked);
    const tall = size === 'strip' ? STRIP : ((SHARED_TILES[where]?.tall ?? first.tall)?.[size] ?? 0);
    return tall + (isTabbed(where, sharing.length) ? TAB_BAR : 0);
  };

  // How wide the corner wants to be: its own width opened out, when it is one that reaches along the bottom.
  const cornerWide = (): number | null => {
    const first = panesIn(panes, 'bottomLeft')[0];
    return first !== undefined && sizeAsked(first, asked) === 'full'
      ? (SHARED_TILES.bottomLeft?.openWide ?? null)
      : null;
  };

  return {
    left: panes.some((pane) => pane.spread === 'left'),
    bottomLeft: tallOf('bottomLeft'),
    bottomLeftWide: cornerWide(),
    bottomMiddle: tallOf('bottomMiddle'),
  };
}

/**
 * What the player has asked the spread's tiles to be, which is two records and not one: a pane with a
 * tile of its own asks for itself, and a tile its panes take turns in is asked once, for all of them.
 */
export interface Asked {
  readonly heights: Readonly<Partial<Record<string, PaneSize>>>;
  readonly tiles: Readonly<Partial<Record<BayName, PaneSize>>>;
}

/**
 * The size a pane was asked to be in the spread: its tile's, if it takes turns in one with others, and
 * otherwise its own - what the player asked for, or full until they have, because a tile is the size its
 * pane asked for rather than a share of a stage it is dividing with somebody.
 *
 * One function, because the layout sizes the tile from it and the control marks it, and the two
 * disagreeing is a mark on a size the tile is not.
 */
export function sizeAsked(pane: Pane, asked: Asked): PaneSize {
  const tile = SHARED_TILES[pane.spread];
  return tile === undefined
    ? (asked.heights[pane.id] ?? 'full')
    : (asked.tiles[pane.spread] ?? tile.startsAt);
}

/**
 * Every pane there is: the fixed ones, then a window per subject, newest first.
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
  /**
   * Whether the pane draws its own size control. Not in a tile its panes take turns in, in the spread:
   * one tile, one size, and one control for it at the end of the tab bar. See decision record 0057.
   */
  ownControl: boolean;
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

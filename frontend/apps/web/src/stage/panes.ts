import type { ReactNode } from 'react';

import type { BayName, RightWants, SpreadWants } from './bayBox';
import { isTabbed, STRIP, TAB_BAR } from './bayBox';
import type { IconName } from './Icons';

/**
 * What can occupy a bay, and what each one asks for.
 *
 * A pane is declared by its feature, in the feature's own folder, and placed by the layout; the root's
 * `panes.tsx` says which stand, in which order, and what draws them, and the stage is handed the list. Two
 * are the stage's own: the map, which is its floor, and navigation, which its compass opens. Nothing in the
 * layout knows what a map is, and no pane learns which bay it is in beyond the room it was given - which is
 * what lets a mechanic be written once and drawn at three sizes. See decision records 0040 and 0041.
 *
 * **What a pane declares is the spread's business only.** On a phone the three sizes are a strip, half the
 * stage and the rest, the same three for every pane, and which of the three arrangements the stage is in
 * belongs to the fold rather than to anything standing in it. So the numbers here are tile heights and
 * nothing else. See decision record 0046.
 *
 * Four of them are fixed and the rest come and go: an **inspect window** is a pane per subject, so the list
 * grows as the player opens them, the **choice roll** stands while a question does, and **character
 * dialogue** from the house's first dialogue on.
 */

/** What a pane draws, given the room it got and how the stage is cut: null in the spread, where there are no bays. */
export type Along = 'rows' | 'columns' | null;

/** A pane as the stage is handed it: what it is, and what draws it in the room it was given. */
export interface PaneDef extends Pane {
  draw(room: Room, along: Along): ReactNode;
  /**
   * How it asks for a size, where that is more than the bay manager's `askFor`: a window opened in the spread
   * comes to the top of the rail. What its control does, and what a press on it put away does.
   */
  ask?: (size: PaneSize) => void;
}

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
   * Where it stands on a phone: **on top**, the map's and the windows' alone, or **below**, everything else's
   * and the bottom bar's to choose between. Below unless it says otherwise. Adam's word of 2026-10-08: the
   * top is the map or a single window. See decision record 0109.
   */
  phone?: 'top' | 'below';
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
  /**
   * The size its tile opens at in the spread, before the player has asked for any; opened out when absent,
   * because a tile is the size its pane asked for rather than a share of anything. A pane whose tile opened
   * out is half the stage says otherwise. A tile its panes take turns in has its own, on {@link SharedTile}.
   */
  startsAt?: PaneSize;
  /**
   * The sizes its control offers in the spread, smallest first; all three when absent. The letter offers two,
   * put away or opened out, because opened out it lies over everything and there is nothing between: Adam's
   * word of 2026-10-06. See decision record 0085.
   */
  spreadSizes?: readonly PaneSize[];
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
  /**
   * How tall it is at the normal size and opened out. Put away it is a strip like any pane's, `STRIP`. Absent for
   * the column down the right, which is top to bottom at every size but put away, and whose widths are the layout's.
   */
  tall?: { full: number; small: number };
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
export const CORNER = {
  tall: { full: 340, small: 232 },
  openWide: 560,
  startsAt: 'small',
} as const satisfies SharedTile;

/**
 * The tiles whose panes take turns, and the sizes each has. A tile that two panes declare themselves into
 * and that is missing here fails a test, because its size would otherwise follow whichever tab was up.
 */
/**
 * **The column down the right**, where the dialogues and the quests take turns: one size whichever of them is up,
 * opening at its normal width, as the dialogues alone did. Its widths are the layout's, so it has no heights. See
 * decision records 0069 and 0096.
 */
export const RIGHT_COLUMN: SharedTile = { startsAt: 'small' };

export const SHARED_TILES: Readonly<Partial<Record<BayName, SharedTile>>> = {
  bottomLeft: CORNER,
  right: RIGHT_COLUMN,
};

export const MAP_PANE: Pane = {
  id: 'map',
  title: 'the map',
  // The ground everything else stands on, rather than a tile competing with the rest for room.
  spread: 'floor',
  phone: 'top',
  // The floor is the whole stage and asks the column for nothing.
  tall: null,
  icon: 'map',
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

  // How the letter along the bottom middle is asked to be: its chip, or its height opened out.
  const letterOf = (): number | 'strip' | null => {
    const first = panesIn(panes, 'bottomMiddle')[0];
    if (first === undefined) {
      return null;
    }
    return sizeAsked(first, asked) === 'strip' ? 'strip' : (first.tall?.full ?? 0);
  };

  // How the column down the right edge is asked to be. Its widths are the layout's, so what it is asked
  // for is which of its three sizes, and the layout says what half of this stage is.
  const rightOf = (): RightWants | null => {
    const first = panesIn(panes, 'right')[0];
    if (first === undefined) {
      return null;
    }
    const size = sizeAsked(first, asked);
    // Put away, a column its panes take turns in keeps room over its strip for their tab bar.
    const tabbed = isTabbed('right', panesIn(panes, 'right').length);
    return size === 'strip' ? (tabbed ? 'tabbedStrip' : 'strip') : size === 'full' ? 'half' : 'normal';
  };

  return {
    left: panes.some((pane) => pane.spread === 'left'),
    bottomLeft: tallOf('bottomLeft'),
    bottomLeftWide: cornerWide(),
    bottomMiddle: letterOf(),
    right: rightOf(),
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
 * otherwise its own - what the player asked for, or what it opens at until they have, which is full unless
 * the pane says otherwise, because a tile is the size its pane asked for rather than a share of a stage it
 * is dividing with somebody.
 *
 * One function, because the layout sizes the tile from it and the control marks it, and the two
 * disagreeing is a mark on a size the tile is not.
 */
export function sizeAsked(pane: Pane, asked: Asked): PaneSize {
  const tile = SHARED_TILES[pane.spread];
  return tile === undefined
    ? (asked.heights[pane.id] ?? pane.startsAt ?? 'full')
    : (asked.tiles[pane.spread] ?? tile.startsAt);
}

/**
 * The tiles of which only one is ever opened out: the corner and the column down the right. Opening one out
 * steps the other down to its normal size, so the bottom row always has the middle of it for the letter's
 * chip. Adam's word of 2026-10-06; see decision record 0085.
 */
export const ONE_OPENED_OUT: readonly BayName[] = ['bottomLeft', 'right'];

/**
 * What the spread's tiles are asked after a pane asks for a size: that size, and, if it opened out one of
 * {@link ONE_OPENED_OUT}, the other of them stepped down from opened out to its normal size. Says which pane
 * stepped down, so that the log can say it; `askFor` in `bays.ts` writes the answer.
 */
export function askedInTheSpread(
  panes: readonly Pane[],
  asked: Asked,
  pane: Pane,
  size: PaneSize,
): { asked: Asked; stepped: Pane | null } {
  // A tile its panes take turns in is asked once for all of them; any other pane is asked for itself.
  const setting = (one: Pane, to: PaneSize, from: Asked): Asked =>
    SHARED_TILES[one.spread] !== undefined
      ? { heights: from.heights, tiles: { ...from.tiles, [one.spread]: to } }
      : { heights: { ...from.heights, [one.id]: to }, tiles: from.tiles };

  const next = setting(pane, size, asked);
  const other = ONE_OPENED_OUT.includes(pane.spread)
    ? ONE_OPENED_OUT.filter((where) => where !== pane.spread).map((where) => panesIn(panes, where)[0])[0]
    : undefined;
  if (size !== 'full' || other === undefined || sizeAsked(other, next) !== 'full') {
    return { asked: next, stepped: null };
  }
  return { asked: setting(other, 'small', next), stepped: other };
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
  /** The sizes its control offers, smallest first: all three, unless the pane offers fewer in the spread. */
  sizes: readonly PaneSize[];
  /** Shows the map, opened to be read, on top of a phone; in the spread the map is the floor. */
  showMap: () => void;
  /** Brings a pane up from this one: where it stands on a phone; in the spread, opened if it was put away. */
  openBeside: (id: string) => void;
  /**
   * Whether the pane draws its own size control. Not in a tile its panes take turns in, in the spread:
   * one tile, one size, and one control for it at the end of the tab bar (0057). Not below the top on a
   * phone, where the pane on top's names the arrangement for both (0109).
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

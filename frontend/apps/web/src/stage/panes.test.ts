import { describe, expect, it } from 'vitest';

import { bayLayout, FOLDS_UNDER, STRIP, TAB_BAR } from './bayBox';
import type { BayName } from './bayBox';
import {
  CHOICE_PANE,
  cramps,
  heightAsked,
  HOUSE_PANE,
  KEY_FIGURES_PANE,
  MAP_PANE,
  NAVIGATION_PANE,
  type Pane,
  panesFor,
  panesIn,
  type PaneSize,
  sizeOf,
  spreadWants,
  standingPanes,
} from './panes';

const NOTHING_ASKED: Readonly<Partial<Record<string, PaneSize>>> = {};
/** The heights a pane declares are the spread's, and every pane with a tile of its own has them. */
const tallOf = (pane: Pane) => pane.tall!;
const showsFirst = (_where: BayName, sharing: readonly Pane[]) => sharing[0]!;
const shows = (id: string) => (where: BayName, sharing: readonly Pane[]) =>
  sharing.find((pane) => pane.id === id) ?? showsFirst(where, sharing);

describe('panesIn', () => {
  it('gathers the panes that declared themselves into one tile, in the order they were declared', () => {
    expect(panesIn(panesFor([], false), 'bottomLeft').map((pane) => pane.id)).toEqual([
      HOUSE_PANE.id,
      KEY_FIGURES_PANE.id,
      NAVIGATION_PANE.id,
    ]);
  });

  it('puts a window in the column and the map in no tile at all', () => {
    const panes = panesFor([{ kind: 'house', id: 'abc' }], false);

    expect(panesIn(panes, 'left')).toHaveLength(1);
    expect(panesIn(panes, 'floor').map((pane) => pane.id)).toEqual(['map']);
  });
});

/**
 * The three sizes, which every pane has and the player picks between.
 *
 * One control and one piece of state. It replaced a set of what was minimised beside a record of what had
 * been resized - the same question asked twice, which let a pane be collapsed *and* small at once. See
 * decision record 0045.
 */
describe('the three sizes', () => {
  it('draws a pane at what was asked for, unless the bay is too small to hold it', () => {
    expect(sizeOf('full', false)).toBe('full');
    expect(sizeOf('full', true)).toBe('small');
    expect(sizeOf('small', false)).toBe('small');
    // Put away stays put away: a bay too small for the full form is not a reason to open one.
    expect(sizeOf('strip', true)).toBe('strip');
  });

  /*
   * Half a phone is not room for the letter laid out, and the whole of one is.
   *
   * The three standard sizes and the carousel meet exactly here. Half of a 390 by 844 phone is a bay 390
   * by 422, which clears neither of the two numbers the full form needs, so it draws the carousel; opened
   * out it is 390 by 800, which clears the height, so it lays the options out. The control goes on marking
   * the middle either way, because it marks the wish and not the outcome. See decision records 0044, 0046.
   */
  it('hands the choice roll its carousel at half a phone and its full form opened out', () => {
    expect(cramps(CHOICE_PANE, { w: 390, h: 422 })).toBe(true);
    expect(cramps(CHOICE_PANE, { w: 390, h: 800 })).toBe(false);
  });

  // Nothing else declares what its full form needs, so nothing else is ever capped.
  it('never caps a pane that did not say what its full form needs', () => {
    expect(cramps(HOUSE_PANE, { w: 40, h: 40 })).toBe(false);
    expect(cramps(MAP_PANE, { w: 40, h: 40 })).toBe(false);
  });
});

describe('spreadWants', () => {
  const panes = panesFor([], false);

  it('makes a shared tile as tall as the pane that is up, plus the strip of tabs', () => {
    expect(spreadWants(panes, NOTHING_ASKED, showsFirst).bottomLeft).toBe(tallOf(HOUSE_PANE).full + TAB_BAR);
  });

  // A tab nobody can see is not taking any room, so it cannot be what sizes the tile.
  it('sizes the tile by whichever tab is up, not by the tallest of them', () => {
    const tall: Pane = { ...NAVIGATION_PANE, tall: { full: 500, small: 500 } };
    const sharing = [HOUSE_PANE, tall];

    expect(spreadWants(sharing, NOTHING_ASKED, shows(tall.id)).bottomLeft).toBe(500 + TAB_BAR);
    expect(spreadWants(sharing, NOTHING_ASKED, shows(HOUSE_PANE.id)).bottomLeft).toBe(
      tallOf(HOUSE_PANE).full + TAB_BAR,
    );
  });

  /*
   * The control means something on a desktop too, which is the point of it being one control.
   *
   * A tile has three heights: put away, the normal card, and opened out. Full is where a tile starts,
   * because a tile is the size the pane asked for rather than a share of a stage it is dividing.
   */
  it('gives a tile its three heights from what the pane was asked to be', () => {
    const shut = { [HOUSE_PANE.id]: 'strip' as const };
    const normal = { [HOUSE_PANE.id]: 'small' as const };

    expect(spreadWants(panes, shut, showsFirst).bottomLeft).toBe(STRIP + TAB_BAR);
    expect(spreadWants(panes, normal, showsFirst).bottomLeft).toBe(tallOf(HOUSE_PANE).small + TAB_BAR);
    expect(spreadWants(panes, NOTHING_ASKED, showsFirst).bottomLeft).toBe(tallOf(HOUSE_PANE).full + TAB_BAR);
  });

  it('ignores a pane that is not the one showing', () => {
    const shut = { [NAVIGATION_PANE.id]: 'strip' as const };

    expect(spreadWants(panes, shut, showsFirst).bottomLeft).toBe(tallOf(HOUSE_PANE).full + TAB_BAR);
  });

  it('takes no room for the strip when one pane has the tile to itself', () => {
    expect(spreadWants([HOUSE_PANE], NOTHING_ASKED, showsFirst).bottomLeft).toBe(tallOf(HOUSE_PANE).full);
  });

  // An empty tile is not a small tile: with no choice pending the map runs clean to the bottom edge.
  it('asks for nothing at all for a tile nobody is in', () => {
    expect(spreadWants(panes, NOTHING_ASKED, showsFirst).bottomMiddle).toBeNull();
    expect(spreadWants([], NOTHING_ASKED, showsFirst).bottomLeft).toBeNull();
  });

  it('says whether anything is in the column above the corner', () => {
    expect(spreadWants(panes, NOTHING_ASKED, showsFirst).left).toBe(false);
    expect(spreadWants(panesFor([{ kind: 'area', id: 'x' }], false), NOTHING_ASKED, showsFirst).left).toBe(
      true,
    );
  });
});

/**
 * The choice roll, which is the one pane that comes and goes.
 *
 * An empty tile takes no room at all, so with nothing pending the map runs clean to the bottom edge of the
 * stage - and the tile appears the moment the world asks something.
 */
describe('the choice roll', () => {
  it('is not a pane at all until the world asks something', () => {
    expect(standingPanes(false).map((pane) => pane.id)).not.toContain(CHOICE_PANE.id);
    expect(standingPanes(true).map((pane) => pane.id)).toContain(CHOICE_PANE.id);
  });

  it('takes the bottom middle, and asks for nothing when there is no question', () => {
    expect(spreadWants(panesFor([], false), NOTHING_ASKED, showsFirst).bottomMiddle).toBeNull();
    expect(spreadWants(panesFor([], true), NOTHING_ASKED, showsFirst).bottomMiddle).toBe(
      tallOf(CHOICE_PANE).full,
    );
  });

  // It has the tile to itself, so there is no strip of tabs to pay for.
  it('does not share its tile, so it costs no tab bar', () => {
    expect(panesIn(panesFor([], true), 'bottomMiddle')).toHaveLength(1);
  });

  // The one whose small form is a different drawing rather than less of the same thing.
  it('says what its full form needs, so a bay too small for it gets the carousel', () => {
    expect(CHOICE_PANE.needs).not.toBeNull();
  });

  // Its tile is one height however it is drawn, so the bottom of the stage does not jump as the player
  // folds it to the carousel and back.
  it('asks for the same tile whichever of its two drawings is in it', () => {
    expect(tallOf(CHOICE_PANE).small).toBe(tallOf(CHOICE_PANE).full);
  });
});

/**
 * The key figures, the corner's middle tab, which is the one pane that does not open at its full size.
 *
 * Its normal size is the house card's full height, so pressing between the two tabs moves nothing and the
 * rail above them stays where it was; opening it out is the player's doing. See decision record 0055.
 */
describe('the key figures', () => {
  const panes = panesFor([], false);

  it('opens at its normal size until the player asks for another, where every other pane opens full', () => {
    expect(heightAsked(KEY_FIGURES_PANE, NOTHING_ASKED)).toBe('small');
    expect(heightAsked(KEY_FIGURES_PANE, { [KEY_FIGURES_PANE.id]: 'full' })).toBe('full');
    expect(heightAsked(HOUSE_PANE, NOTHING_ASKED)).toBe('full');
  });

  it('holds the corner still between its tab and the house status', () => {
    expect(spreadWants(panes, NOTHING_ASKED, shows(KEY_FIGURES_PANE.id)).bottomLeft).toBe(
      spreadWants(panes, NOTHING_ASKED, shows(HOUSE_PANE.id)).bottomLeft,
    );
  });

  /*
   * Opened out it is as tall as the corner can be and still leave a window room in the rail above it, on
   * the shortest stage the spread is ever drawn on. A hundred and fifty pixels is a window's head and a
   * line or two of it, which is the least a rail is worth keeping.
   */
  // Only opened out, and only while its tab is up: the corner is the column's width the rest of the time.
  it('asks the corner to reach along the bottom when it is opened out, and at no other time', () => {
    const opened = { [KEY_FIGURES_PANE.id]: 'full' as const };

    expect(spreadWants(panes, opened, shows(KEY_FIGURES_PANE.id)).bottomLeftWide).toBe(
      KEY_FIGURES_PANE.openWide,
    );
    expect(spreadWants(panes, NOTHING_ASKED, shows(KEY_FIGURES_PANE.id)).bottomLeftWide).toBeNull();
    expect(spreadWants(panes, opened, shows(HOUSE_PANE.id)).bottomLeftWide).toBeNull();
  });

  /*
   * The first time one tile's size changes another's form. On a 1000-wide stage the letter lays its
   * options out beside the corner as it always has; with the key figures opened out the corner reaches
   * along the bottom and the letter, moved over, has room for its carousel instead. See 0056.
   */
  it('folds a letter to its carousel on a 1000-wide stage, while the corner reaches along the bottom', () => {
    const stage = { w: 1000, h: 900 };
    const asking = panesFor([], true);
    const laidOut = (heights: Readonly<Partial<Record<string, PaneSize>>>) =>
      bayLayout(stage, ['big', 'big'], spreadWants(asking, heights, shows(KEY_FIGURES_PANE.id)), 'spread')
        .bays.bottomMiddle;

    expect(cramps(CHOICE_PANE, laidOut(NOTHING_ASKED))).toBe(false);
    expect(cramps(CHOICE_PANE, laidOut({ [KEY_FIGURES_PANE.id]: 'full' }))).toBe(true);
  });

  it('leaves the rail room for a window when it is opened out on the shortest spread', () => {
    const opened = spreadWants(
      panesFor([{ kind: 'house', id: 'abc' }], false),
      { [KEY_FIGURES_PANE.id]: 'full' },
      shows(KEY_FIGURES_PANE.id),
    );
    const layout = bayLayout({ w: 1000, h: FOLDS_UNDER + 1 }, ['big', 'big'], opened, 'spread');

    expect(layout.form).toBe('spread');
    expect(layout.bays.left?.h).toBeGreaterThanOrEqual(150);
  });
});

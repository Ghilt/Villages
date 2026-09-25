import { describe, expect, it } from 'vitest';

import { bayLayout, FOLDS_UNDER, isTabbed, STRIP, TAB_BAR, TILES } from './bayBox';
import {
  type Asked,
  CHOICE_PANE,
  CORNER,
  cramps,
  HOUSE_PANE,
  KEY_FIGURES_PANE,
  MAP_PANE,
  NAVIGATION_PANE,
  type Pane,
  panesFor,
  panesIn,
  type PaneSize,
  SHARED_TILES,
  SIZES,
  sizeAsked,
  sizeOf,
  spreadWants,
  standingPanes,
} from './panes';

const NOTHING_ASKED: Asked = { heights: {}, tiles: {} };
/** The corner asked to be one of its three sizes, which is the one thing about it a player can ask. */
const cornerAt = (size: PaneSize): Asked => ({ heights: {}, tiles: { bottomLeft: size } });
/** The heights a pane declares are the spread's, and every pane with a tile of its own has them. */
const tallOf = (pane: Pane) => pane.tall!;

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

  it('makes a shared tile its own size, plus the strip of tabs', () => {
    expect(spreadWants(panes, NOTHING_ASKED).bottomLeft).toBe(CORNER.tall.small + TAB_BAR);
  });

  /*
   * The control means something on a desktop too, which is the point of it being one control.
   *
   * The corner has three heights: put away, the normal size, and opened out. It opens at the normal one,
   * which is the house card's whole height, and the other two are the player's own doing.
   */
  it('gives the corner its three heights from what the corner was asked to be', () => {
    expect(spreadWants(panes, cornerAt('strip')).bottomLeft).toBe(STRIP + TAB_BAR);
    expect(spreadWants(panes, cornerAt('small')).bottomLeft).toBe(CORNER.tall.small + TAB_BAR);
    expect(spreadWants(panes, cornerAt('full')).bottomLeft).toBe(CORNER.tall.full + TAB_BAR);
  });

  /*
   * Changing tab never results in a size change, which is the whole of decision record 0057.
   *
   * Every pane in the corner answers with the corner's size, so whichever of them is up - and the layout is
   * not even told which - the corner is the same size, and a pane's own entry never reaches it.
   */
  it('answers every pane in the corner with the corner size, whatever it is', () => {
    for (const size of SIZES) {
      for (const pane of panesIn(panes, 'bottomLeft')) {
        expect(sizeAsked(pane, cornerAt(size))).toBe(size);
      }
    }
    expect(sizeAsked(HOUSE_PANE, { heights: { [HOUSE_PANE.id]: 'strip' }, tiles: {} })).toBe(CORNER.startsAt);
  });

  // A tile whose panes take turns, and that had no sizes of its own, would be sized by whichever tab came
  // first; this is what stops the next tabbed tile from quietly doing that.
  it('has sizes of its own for every tile whose panes take turns', () => {
    const everything = panesFor([{ kind: 'house', id: 'abc' }], true);

    for (const where of TILES) {
      if (isTabbed(where, panesIn(everything, where).length)) {
        expect(SHARED_TILES[where], where).toBeDefined();
      }
    }
  });

  it('takes no room for the strip when one pane has the tile to itself', () => {
    expect(spreadWants([HOUSE_PANE], NOTHING_ASKED).bottomLeft).toBe(CORNER.tall.small);
  });

  // An empty tile is not a small tile: with no choice pending the map runs clean to the bottom edge.
  it('asks for nothing at all for a tile nobody is in', () => {
    expect(spreadWants(panes, NOTHING_ASKED).bottomMiddle).toBeNull();
    expect(spreadWants([], NOTHING_ASKED).bottomLeft).toBeNull();
  });

  it('says whether anything is in the column above the corner', () => {
    expect(spreadWants(panes, NOTHING_ASKED).left).toBe(false);
    expect(spreadWants(panesFor([{ kind: 'area', id: 'x' }], false), NOTHING_ASKED).left).toBe(true);
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
    expect(spreadWants(panesFor([], false), NOTHING_ASKED).bottomMiddle).toBeNull();
    expect(spreadWants(panesFor([], true), NOTHING_ASKED).bottomMiddle).toBe(tallOf(CHOICE_PANE).full);
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
 * The corner: the house status, the key figures and navigation, one size whichever of them is up.
 *
 * Its normal size is the house card's whole height and it opens there; opened out, it is what the key
 * figures' details need, and every tab is drawn at that size too. Changing tab never results in a size
 * change. See decision records 0055, 0056 and 0057.
 */
describe('the corner', () => {
  const panes = panesFor([], false);

  it('opens at its normal size until the player asks for another, where a tile of its own opens full', () => {
    expect(sizeAsked(KEY_FIGURES_PANE, NOTHING_ASKED)).toBe('small');
    expect(sizeAsked(HOUSE_PANE, NOTHING_ASKED)).toBe('small');
    expect(sizeAsked(CHOICE_PANE, NOTHING_ASKED)).toBe('full');
    expect(sizeAsked(CHOICE_PANE, { heights: { [CHOICE_PANE.id]: 'strip' }, tiles: {} })).toBe('strip');
  });

  // Opened out, and only opened out: the corner is the column's width the rest of the time.
  it('reaches along the bottom when it is opened out, and at no other time', () => {
    expect(spreadWants(panes, cornerAt('full')).bottomLeftWide).toBe(CORNER.openWide);
    expect(spreadWants(panes, cornerAt('small')).bottomLeftWide).toBeNull();
    expect(spreadWants(panes, cornerAt('strip')).bottomLeftWide).toBeNull();
  });

  /*
   * The first time one tile's size changes another's form. On a 1000-wide stage the letter lays its
   * options out beside the corner as it always has; with the corner opened out it reaches along the
   * bottom and the letter, moved over, has room for its carousel instead. See 0056.
   */
  it('folds a letter to its carousel on a 1000-wide stage, while the corner reaches along the bottom', () => {
    const stage = { w: 1000, h: 900 };
    const asking = panesFor([], true);
    const laidOut = (asked: Asked) =>
      bayLayout(stage, ['big', 'big'], spreadWants(asking, asked), 'spread').bays.bottomMiddle;

    expect(cramps(CHOICE_PANE, laidOut(NOTHING_ASKED))).toBe(false);
    expect(cramps(CHOICE_PANE, laidOut(cornerAt('full')))).toBe(true);
  });

  /*
   * Opened out it is as tall as the corner can be and still leave a window room in the rail above it, on
   * the shortest stage the spread is ever drawn on. A hundred and fifty pixels is a window's head and a
   * line or two of it, which is the least a rail is worth keeping.
   */
  it('leaves the rail room for a window when it is opened out on the shortest spread', () => {
    const opened = spreadWants(panesFor([{ kind: 'house', id: 'abc' }], false), cornerAt('full'));
    const layout = bayLayout({ w: 1000, h: FOLDS_UNDER + 1 }, ['big', 'big'], opened, 'spread');

    expect(layout.form).toBe('spread');
    expect(layout.bays.left?.h).toBeGreaterThanOrEqual(150);
  });
});

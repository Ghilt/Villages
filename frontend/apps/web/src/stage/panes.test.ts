import { describe, expect, it } from 'vitest';

import { TAB_BAR } from './bayBox';
import type { BayName } from './bayBox';
import {
  askingOf,
  CHOICE_PANE,
  HOUSE_PANE,
  MAP_PANE,
  NAVIGATION_PANE,
  offersOf,
  type Pane,
  panesFor,
  panesIn,
  type PaneSize,
  sizeOf,
  spreadWants,
  standingPanes,
  wantedIn,
} from './panes';

const NOTHING_ASKED: Readonly<Partial<Record<string, PaneSize>>> = {};
const showsFirst = (_where: BayName, sharing: readonly Pane[]) => sharing[0]!;
const shows = (id: string) => (where: BayName, sharing: readonly Pane[]) =>
  sharing.find((pane) => pane.id === id) ?? showsFirst(where, sharing);

describe('panesIn', () => {
  it('gathers the panes that declared themselves into one tile, in the order they were declared', () => {
    expect(panesIn(panesFor([], false), 'bottomLeft').map((pane) => pane.id)).toEqual([
      HOUSE_PANE.id,
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
  it('offers all three to a pane that has a strip, and two to one that has not', () => {
    expect(offersOf(HOUSE_PANE)).toEqual(['strip', 'small', 'full']);
    // A strip of map is not a map, so the map cannot be put away. See decision record 0040.
    expect(offersOf(MAP_PANE)).toEqual(['small', 'full']);
  });

  it('starts a pane at what it was declared to want, in the bays', () => {
    expect(wantedIn(HOUSE_PANE)).toBe('small');
    expect(wantedIn(MAP_PANE)).toBe('full');
    expect(wantedIn(CHOICE_PANE)).toBe('full');
  });

  it('turns each size into what its bay asks the layout for', () => {
    expect(askingOf(HOUSE_PANE, 'full')).toBe('big');
    expect(askingOf(HOUSE_PANE, 'small')).toEqual({ small: HOUSE_PANE.small });
    expect(askingOf(HOUSE_PANE, 'strip')).toEqual({ small: HOUSE_PANE.strip });
  });

  // A pane with no strip asked for one anyway is drawn small rather than vanishing.
  it('gives a pane with no strip its small size when asked to put it away', () => {
    expect(askingOf(MAP_PANE, 'strip')).toEqual({ small: MAP_PANE.small });
  });

  it('draws a pane at what was asked for, unless the bay is too small to hold it', () => {
    expect(sizeOf('full', false)).toBe('full');
    expect(sizeOf('full', true)).toBe('small');
    expect(sizeOf('small', false)).toBe('small');
    // Put away stays put away: a bay too small for the full form is not a reason to open one.
    expect(sizeOf('strip', true)).toBe('strip');
  });
});

describe('spreadWants', () => {
  const panes = panesFor([], false);

  it('makes a shared tile as tall as the pane that is up, plus the strip of tabs', () => {
    expect(spreadWants(panes, NOTHING_ASKED, showsFirst).bottomLeft).toBe(HOUSE_PANE.tall + TAB_BAR);
  });

  // A tab nobody can see is not taking any room, so it cannot be what sizes the tile.
  it('sizes the tile by whichever tab is up, not by the tallest of them', () => {
    const tall: Pane = { ...NAVIGATION_PANE, tall: 500 };
    const sharing = [HOUSE_PANE, tall];

    expect(spreadWants(sharing, NOTHING_ASKED, shows(tall.id)).bottomLeft).toBe(500 + TAB_BAR);
    expect(spreadWants(sharing, NOTHING_ASKED, shows(HOUSE_PANE.id)).bottomLeft).toBe(
      HOUSE_PANE.tall + TAB_BAR,
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

    expect(spreadWants(panes, shut, showsFirst).bottomLeft).toBe(HOUSE_PANE.strip! + TAB_BAR);
    expect(spreadWants(panes, normal, showsFirst).bottomLeft).toBe(HOUSE_PANE.small + TAB_BAR);
    expect(spreadWants(panes, NOTHING_ASKED, showsFirst).bottomLeft).toBe(HOUSE_PANE.tall + TAB_BAR);
  });

  it('ignores a pane that is not the one showing', () => {
    const shut = { [NAVIGATION_PANE.id]: 'strip' as const };

    expect(spreadWants(panes, shut, showsFirst).bottomLeft).toBe(HOUSE_PANE.tall + TAB_BAR);
  });

  it('takes no room for the strip when one pane has the tile to itself', () => {
    expect(spreadWants([HOUSE_PANE], NOTHING_ASKED, showsFirst).bottomLeft).toBe(HOUSE_PANE.tall);
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
    expect(spreadWants(panesFor([], true), NOTHING_ASKED, showsFirst).bottomMiddle).toBe(CHOICE_PANE.tall);
  });

  // It has the tile to itself, so there is no strip of tabs to pay for.
  it('does not share its tile, so it costs no tab bar', () => {
    expect(panesIn(panesFor([], true), 'bottomMiddle')).toHaveLength(1);
  });

  // The one whose small form is a different drawing rather than less of the same thing.
  it('says what its full form needs, so a bay too small for it gets the carousel', () => {
    expect(CHOICE_PANE.needs).not.toBeNull();
    expect(askingOf(CHOICE_PANE, 'small')).toEqual({ small: CHOICE_PANE.small });
  });
});

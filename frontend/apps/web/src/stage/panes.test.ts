import { describe, expect, it } from 'vitest';

import { TAB_BAR } from './bayBox';
import type { BayName } from './bayBox';
import {
  askingOf,
  CHOICE_PANE,
  HOUSE_PANE,
  NAVIGATION_PANE,
  type Pane,
  panesFor,
  panesIn,
  spreadWants,
  standingPanes,
} from './panes';

/**
 * What the spread's tiles ask for, which is where a tab bar turns into room.
 *
 * The arithmetic in `bayBox` knows nothing about tabs: it is told a height, and this is what works that
 * height out. So this is where "a tile with two panes in it is that much taller" is checked.
 */

const NOTHING_SHUT: ReadonlySet<string> = new Set();
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

describe('spreadWants', () => {
  const panes = panesFor([], false);

  it('makes a shared tile as tall as the pane that is up, plus the strip of tabs', () => {
    expect(spreadWants(panes, NOTHING_SHUT, showsFirst).bottomLeft).toBe(HOUSE_PANE.tall + TAB_BAR);
  });

  // A tab nobody can see is not taking any room, so it cannot be what sizes the tile.
  it('sizes the tile by whichever tab is up, not by the tallest of them', () => {
    const tall: Pane = { ...NAVIGATION_PANE, tall: 500 };
    const sharing = [HOUSE_PANE, tall];

    expect(spreadWants(sharing, NOTHING_SHUT, shows(tall.id)).bottomLeft).toBe(500 + TAB_BAR);
    expect(spreadWants(sharing, NOTHING_SHUT, shows(HOUSE_PANE.id)).bottomLeft).toBe(
      HOUSE_PANE.tall + TAB_BAR,
    );
  });

  // Minimise is what gives the column's room back to the rail, in the spread as on a phone.
  it('shrinks the tile to the strip when the pane that is up is minimised', () => {
    const shut = new Set([HOUSE_PANE.id]);

    expect(spreadWants(panes, shut, showsFirst).bottomLeft).toBe(HOUSE_PANE.strip! + TAB_BAR);
  });

  it('ignores a minimised pane that is not the one showing', () => {
    const shut = new Set([NAVIGATION_PANE.id]);

    expect(spreadWants(panes, shut, showsFirst).bottomLeft).toBe(HOUSE_PANE.tall + TAB_BAR);
  });

  it('takes no room for the strip when one pane has the tile to itself', () => {
    expect(spreadWants([HOUSE_PANE], NOTHING_SHUT, showsFirst).bottomLeft).toBe(HOUSE_PANE.tall);
  });

  // An empty tile is not a small tile: with no choice pending the map runs clean to the bottom edge.
  it('asks for nothing at all for a tile nobody is in', () => {
    expect(spreadWants(panes, NOTHING_SHUT, showsFirst).bottomMiddle).toBeNull();
    expect(spreadWants([], NOTHING_SHUT, showsFirst).bottomLeft).toBeNull();
  });

  it('says whether anything is in the column above the corner', () => {
    expect(spreadWants(panes, NOTHING_SHUT, showsFirst).left).toBe(false);
    expect(spreadWants(panesFor([{ kind: 'area', id: 'x' }], false), NOTHING_SHUT, showsFirst).left).toBe(
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
    expect(spreadWants(panesFor([], false), NOTHING_SHUT, showsFirst).bottomMiddle).toBeNull();
    expect(spreadWants(panesFor([], true), NOTHING_SHUT, showsFirst).bottomMiddle).toBe(CHOICE_PANE.tall);
  });

  // It has the tile to itself, so there is no strip of tabs to pay for.
  it('does not share its tile, so it costs no tab bar', () => {
    expect(panesIn(panesFor([], true), 'bottomMiddle')).toHaveLength(1);
  });

  // The one pane whose size is the player's, which is what `bothSizes` says and what `swapSize` acts on.
  it('is the only pane that lets the player choose between its two sizes', () => {
    const chooses = panesFor([{ kind: 'house', id: 'abc' }], true).filter((pane) => pane.bothSizes);

    expect(chooses.map((pane) => pane.id)).toEqual([CHOICE_PANE.id]);
  });

  it('asks big by default, the carousel when the player asked small, the letter when minimised', () => {
    expect(askingOf(CHOICE_PANE, false, undefined)).toBe('big');
    expect(askingOf(CHOICE_PANE, false, 'small')).toEqual({ small: CHOICE_PANE.small });
    expect(askingOf(CHOICE_PANE, true, 'big')).toEqual({ small: CHOICE_PANE.strip });
  });
});

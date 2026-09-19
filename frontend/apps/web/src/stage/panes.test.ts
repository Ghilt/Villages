import { describe, expect, it } from 'vitest';

import { TAB_BAR } from './bayBox';
import type { BayName } from './bayBox';
import { HOUSE_PANE, NAVIGATION_PANE, type Pane, panesIn, panesFor, spreadWants } from './panes';

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
    expect(panesIn(panesFor([]), 'bottomLeft').map((pane) => pane.id)).toEqual([
      HOUSE_PANE.id,
      NAVIGATION_PANE.id,
    ]);
  });

  it('puts a window in the column and the map in no tile at all', () => {
    const panes = panesFor([{ kind: 'house', id: 'abc' }]);

    expect(panesIn(panes, 'left')).toHaveLength(1);
    expect(panesIn(panes, 'floor').map((pane) => pane.id)).toEqual(['map']);
  });
});

describe('spreadWants', () => {
  const panes = panesFor([]);

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
    expect(spreadWants(panesFor([{ kind: 'area', id: 'x' }]), NOTHING_SHUT, showsFirst).left).toBe(true);
  });
});

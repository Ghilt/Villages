import { describe, expect, it } from 'vitest';

import { latticeFrom } from '../../ui/diorama/lattice';
import { FONT, PLATFORM, WATER } from './blocks';
import { SQUARE } from './square';
import type { Arrangement, Point } from './venue';

const HELD: readonly [string, Arrangement][] = [
  ['wide', SQUARE.wide],
  ['deep', SQUARE.deep],
];

describe.each(HELD)('the square held %s, laid on the map’s lattice', (_, arrangement) => {
  const on = (point: Point) => latticeFrom(arrangement.lattice, point);
  const cellOf = (point: Point) => {
    const { u, v } = on(point);
    return `${Math.floor(u)},${Math.floor(v)}`;
  };
  const figures = [
    ...arrangement.townsfolk.a,
    ...arrangement.townsfolk.b,
    ...arrangement.summons.a,
    ...arrangement.summons.b,
  ];
  /** The cells a block covers: `cells` a side about its middle. */
  const covered = (middle: Point, cells: number) => {
    const { u, v } = on(middle);
    const taken = new Set<string>();
    for (let du = -cells / 2; du < cells / 2; du += 1) {
      for (let dv = -cells / 2; dv < cells / 2; dv += 1)
        taken.add(`${Math.floor(u + du + 0.01)},${Math.floor(v + dv + 0.01)}`);
    }
    return taken;
  };

  it('stands every figure in the middle of a cell, and no two in one', () => {
    for (const figure of figures) {
      const { u, v } = on(figure);
      expect(u - Math.floor(u)).toBeCloseTo(0.5);
      expect(v - Math.floor(v)).toBeCloseTo(0.5);
    }
    expect(new Set(figures.map(cellOf)).size).toBe(figures.length);
  });

  it('stands nobody on a platform or on the font', () => {
    const taken = new Set([
      ...covered(arrangement.platforms.a, PLATFORM.cells),
      ...covered(arrangement.platforms.b, PLATFORM.cells),
      ...covered(arrangement.receptacle, FONT.cells),
    ]);
    for (const figure of figures) expect(taken.has(cellOf(figure)), cellOf(figure)).toBe(false);
  });

  it('stands each platform on whole cells and the font on a corner', () => {
    for (const platform of [arrangement.platforms.a, arrangement.platforms.b]) {
      const { u, v } = on(platform);
      expect(u - Math.floor(u)).toBeCloseTo(0.5);
      expect(v - Math.floor(v)).toBeCloseTo(0.5);
    }
    const font = on(arrangement.receptacle);
    expect(font.u).toBeCloseTo(Math.round(font.u));
    expect(font.v).toBeCloseTo(Math.round(font.v));
  });

  it('runs the happenings’ path along the cells’ sides, a leg at a time, then up into the font’s water', () => {
    const legs = arrangement.path.slice(0, -1);
    for (let at = 1; at < legs.length; at += 1) {
      const from = on(legs[at - 1]!);
      const to = on(legs[at]!);
      expect(from.u).toBeCloseTo(Math.round(from.u));
      expect(from.v).toBeCloseTo(Math.round(from.v));
      const along = Math.abs(to.u - from.u) > 0.01 ? 1 : 0;
      const across = Math.abs(to.v - from.v) > 0.01 ? 1 : 0;
      expect(along + across).toBe(1);
    }
    const rest = arrangement.path[arrangement.path.length - 1]!;
    expect(legs[legs.length - 1]).toEqual(arrangement.receptacle);
    expect(rest.x).toBeCloseTo(arrangement.receptacle.x);
    expect(arrangement.receptacle.y - rest.y).toBeCloseTo(WATER * arrangement.cell);
  });

  it('draws a figure as tall as the map draws a character, three world units', () => {
    expect(arrangement.figure).toBe(3 * arrangement.cell);
  });
});

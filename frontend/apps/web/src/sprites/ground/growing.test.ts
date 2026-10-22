import { describe, expect, it } from 'vitest';
import { GROUND_LATTICE, frameOf, worldXOf, worldYOf } from '@villages/world';

import { cellOf } from '@villages/world';

import { cellsTouched, sceneryCellKey, whereSceneryGrows } from './growing';
import { WORKED } from './worked';
import { diamondKey, workedGround } from './workedGround';

const FRAME = frameOf(GROUND_LATTICE);
const castle = { id: 'structure:castle', u: 1000, v: 400, side: 6, ruin: false, settlement: false };
const worked = workedGround([castle]);

/** The middle of a diamond, in world space. */
const middleOf = (u: number, v: number) =>
  [worldXOf(FRAME, u + 0.5, v + 0.5), worldYOf(FRAME, u + 0.5, v + 0.5)] as const;

describe('where the scenery grows', () => {
  it('never on worked ground: no tree stands in a yard', () => {
    const grows = whereSceneryGrows(undefined, worked)!;
    expect(grows(...middleOf(castle.u - 1, castle.v - 1))).toBe(false);
    expect(grows(...middleOf(castle.u - 6, castle.v - 6))).toBe(false);
  });

  it('everywhere else the fog lets it: all ground with the fog off, none for a house that sees nothing', () => {
    expect(whereSceneryGrows(undefined, worked)!(...middleOf(castle.u + 20, castle.v))).toBe(true);
    expect(whereSceneryGrows(null, worked)!(...middleOf(castle.u + 20, castle.v))).toBe(false);
    expect(whereSceneryGrows(undefined, new Map())).toBeNull();
  });
});

describe('the woods a change of the worked ground touches', () => {
  const far = { u: castle.u + 300, v: castle.v + 200 };
  const cellUnder = (u: number, v: number) => {
    const [x, y] = middleOf(u, v);
    return sceneryCellKey(cellOf(x), cellOf(y));
  };

  it('the cell under a diamond that came, and none of the ground that stayed', () => {
    const now = new Map(worked).set(diamondKey(far.u, far.v), WORKED.wayside);
    const touched = cellsTouched(worked, now);
    expect(touched.has(cellUnder(far.u, far.v))).toBe(true);
    expect(touched.has(cellUnder(castle.u, castle.v))).toBe(false);
  });

  it('the cell under a diamond that went, the same as one that came', () => {
    const before = new Map(worked).set(diamondKey(far.u, far.v), WORKED.wayside);
    expect(cellsTouched(before, worked).has(cellUnder(far.u, far.v))).toBe(true);
  });

  it('nothing when a diamond only changed its kind, which no tree asks', () => {
    const key = [...worked.keys()][0]!;
    const changed = new Map(worked).set(key, worked.get(key) === WORKED.path ? WORKED.wayside : WORKED.path);
    expect(cellsTouched(worked, changed).size).toBe(0);
    expect(cellsTouched(worked, worked).size).toBe(0);
  });
});

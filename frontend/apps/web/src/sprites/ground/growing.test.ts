import { describe, expect, it } from 'vitest';
import { GROUND_LATTICE, frameOf, worldXOf, worldYOf } from '@villages/world';

import { whereSceneryGrows } from './growing';
import { workedGround } from './workedGround';

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

import { describe, expect, it } from 'vitest';

import { COAST, LAKE, RIVER, SEA, groundOf } from './ground.ts';
import { createRaster } from './raster.ts';

const OCEAN = 0;
const LAKE_ID = 2;
const RIVER_ID = 3;
const FOREST = 10;
const MEADOW = 17;
const water = { sea: new Set([OCEAN, 1]), lake: new Set([LAKE_ID]), river: new Set([RIVER_ID]) };

describe('the ground map', () => {
  it('keeps the commonest ground of a cell, leaving the rivers aside, and marks what water is in it', () => {
    // Four by two pixels in cells of two: forest with a river through it, then meadow on the coast.
    const world = createRaster(4, 2);
    world.cells.set([FOREST, RIVER_ID, MEADOW, OCEAN, RIVER_ID, FOREST, MEADOW, MEADOW]);

    const ground = groundOf(world, water, 2);

    expect([ground.width, ground.height]).toEqual([2, 1]);
    expect([...ground.cells]).toEqual([FOREST, RIVER, MEADOW, SEA | COAST]);
  });

  it('marks a lake without calling it coast, and open sea without either', () => {
    const world = createRaster(4, 2);
    world.cells.set([LAKE_ID, FOREST, OCEAN, OCEAN, FOREST, FOREST, OCEAN, OCEAN]);

    const ground = groundOf(world, water, 2);

    expect([...ground.cells]).toEqual([FOREST, LAKE, OCEAN, SEA]);
  });

  it('calls a cell of nothing but river a river, and rounds a ragged edge up to a whole cell', () => {
    const world = createRaster(3, 1);
    world.cells.set([RIVER_ID, RIVER_ID, MEADOW]);

    const ground = groundOf(world, water, 2);

    expect([ground.width, ground.height]).toEqual([2, 1]);
    expect([...ground.cells]).toEqual([RIVER_ID, RIVER, MEADOW, 0]);
  });
});

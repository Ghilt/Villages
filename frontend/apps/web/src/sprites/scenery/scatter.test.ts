import { describe, expect, it } from 'vitest';

import { KINDS, TERRAIN, kindFor, whatGrows } from './kinds';
import { CELL, cellOf, scatterCell } from './scatter';
import type { ClassAt } from './scatter';

const OCEAN = 0;
const everywhere =
  (id: number): ClassAt =>
  () =>
    id;
/** Conifer forest west of the meridian of the cell, meadow east of it: a coast to test gating on. */
const halfAndHalf =
  (at: number): ClassAt =>
  (x) =>
    x < at ? TERRAIN.coniferForest : TERRAIN.meadow;

describe('where scenery stands', () => {
  it('is the same every time, so a cell thrown away and made again is the same ground', () => {
    const once = scatterCell(40, 17, 2, everywhere(TERRAIN.coniferForest));
    const twice = scatterCell(40, 17, 2, everywhere(TERRAIN.coniferForest));

    expect(once.length).toBeGreaterThan(0);
    expect(twice).toEqual(once);
  });

  it('gives no two points the same place, within a cell or across the seam between two', () => {
    const left = scatterCell(0, 0, 2, everywhere(TERRAIN.coniferForest));
    const right = scatterCell(1, 0, 2, everywhere(TERRAIN.coniferForest));
    const places = new Set([...left, ...right].map((p) => `${p.x},${p.y}`));

    expect(places.size).toBe(left.length + right.length);
  });

  it('keeps each cell inside its own square, so the seam has no gap and no overlap', () => {
    const points = scatterCell(3, 5, 2, everywhere(TERRAIN.coniferForest));

    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(3 * CELL);
      expect(point.x).toBeLessThan(4 * CELL);
      expect(point.y).toBeGreaterThanOrEqual(5 * CELL);
      expect(point.y).toBeLessThan(6 * CELL);
      expect(cellOf(point.x)).toBe(3);
      expect(cellOf(point.y)).toBe(5);
    }
  });
});

describe('what grows where', () => {
  it('grows nothing at sea, however dense the scattering is asked to be', () => {
    expect(scatterCell(0, 0, 0.5, everywhere(OCEAN))).toEqual([]);
    expect(scatterCell(12, 9, 4, everywhere(OCEAN))).toEqual([]);
  });

  it('grows only what belongs on the ground it is on', () => {
    const conifer = scatterCell(0, 0, 2, everywhere(TERRAIN.coniferForest));
    const names = new Set(conifer.map((p) => KINDS[p.kind]?.name));

    // Only the pine has any weight on conifer forest.
    expect([...names]).toEqual(['pine']);
  });

  it('follows the ground across a coast rather than the cell it is in', () => {
    const at = 3 * CELL + CELL / 2;
    const points = scatterCell(3, 0, 1, halfAndHalf(at));

    for (const point of points) {
      const name = KINDS[point.kind]?.name;
      if (point.x < at) {
        expect(name).toBe('pine');
      } else {
        // Meadow carries grass mostly and the odd oak, and never a pine.
        expect(name).not.toBe('pine');
      }
    }
    expect(points.some((p) => p.x < at)).toBe(true);
    expect(points.some((p) => p.x >= at)).toBe(true);
  });

  it('picks a kind by its weight, so the commoner one is commoner', () => {
    const points = scatterCell(0, 0, 0.5, everywhere(TERRAIN.meadow));
    const grass = points.filter((p) => KINDS[p.kind]?.name === 'grass tuft').length;
    const oak = points.filter((p) => KINDS[p.kind]?.name === 'oak').length;

    // Ten to one in the table, so grass should be far commoner than oak but oak should be there.
    expect(oak).toBeGreaterThan(0);
    expect(grass).toBeGreaterThan(oak * 4);
  });
});

describe('the order they are let in', () => {
  it('runs from the lowest rank up, so taking the first so many takes the lowest', () => {
    const points = scatterCell(7, 7, 1, everywhere(TERRAIN.coniferForest));

    for (let index = 1; index < points.length; index += 1) {
      expect(points[index]!.rank).toBeGreaterThanOrEqual(points[index - 1]!.rank);
    }
  });

  it('makes a thinner scattering a subset of a denser one, so nothing is reshuffled', () => {
    const points = scatterCell(7, 7, 1, everywhere(TERRAIN.coniferForest));
    const thin = points.slice(0, 20).map((p) => `${p.x},${p.y}`);
    const dense = points.slice(0, 60).map((p) => `${p.x},${p.y}`);

    expect(dense.slice(0, 20)).toEqual(thin);
  });

  it('spreads the ranks over the whole of nought to one', () => {
    const ranks = scatterCell(2, 2, 1, everywhere(TERRAIN.coniferForest)).map((p) => p.rank);

    expect(Math.min(...ranks)).toBeLessThan(0.05);
    expect(Math.max(...ranks)).toBeGreaterThan(0.95);
    for (const rank of ranks) {
      expect(rank).toBeGreaterThanOrEqual(0);
      expect(rank).toBeLessThan(1);
    }
  });
});

describe('how many there are, and how big', () => {
  it('quadruples when the spacing is halved, because it is a grid over an area', () => {
    const coarse = scatterCell(0, 0, 4, everywhere(TERRAIN.coniferForest)).length;
    const fine = scatterCell(0, 0, 2, everywhere(TERRAIN.coniferForest)).length;

    expect(fine).toBe(coarse * 4);
  });

  it('varies a height about its kind, and never past what the kind allows', () => {
    const points = scatterCell(0, 0, 1, everywhere(TERRAIN.coniferForest));
    const pine = KINDS[0]!;
    const heights = new Set(points.map((p) => p.height));

    expect(heights.size).toBeGreaterThan(10);
    for (const point of points) {
      expect(point.height).toBeGreaterThanOrEqual(pine.groundHeight * (1 - pine.vary) - 1e-9);
      expect(point.height).toBeLessThanOrEqual(pine.groundHeight * (1 + pine.vary) + 1e-9);
    }
  });
});

describe('the table of what grows', () => {
  it('says nothing grows on ground no kind claims', () => {
    const growing = whatGrows();

    expect(growing[OCEAN]?.total).toBe(0);
    expect(kindFor(growing[OCEAN]!, 0.5)).toBe(-1);
    // Ice and bare rock are claimed by nothing yet either.
    expect(growing[4]?.total).toBe(0);
  });

  it('never picks a kind with no weight on that ground', () => {
    const growing = whatGrows();
    for (let roll = 0; roll < 1; roll += 0.01) {
      const picked = kindFor(growing[TERRAIN.coniferForest]!, roll);
      expect(KINDS[picked]?.on[TERRAIN.coniferForest]).toBeGreaterThan(0);
    }
  });
});

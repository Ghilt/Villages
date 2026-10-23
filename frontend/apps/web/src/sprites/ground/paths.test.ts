import { describe, expect, it } from 'vitest';
import { GROUND_LATTICE, frameOf, worldXOf, worldYOf } from '@villages/world';

import { courseBetween, pairsWithin, pathsOf, rememberingPaths, wearPaths } from './paths';
import type { Footing, GroundOf } from './paths';
import { WORKED } from './worked';
import { diamondKey, diamondOf, workedGround } from './workedGround';
import type { Yard } from './workedGround';

const yard = (id: string, u: number, v: number, side = 3): Yard => ({
  id,
  u,
  v,
  side,
  ruin: false,
  settlement: false,
});
const mill = yard('structure:mill', 100, 100);
const manor = yard('structure:manor', 112, 104);
const far = yard('structure:far', 160, 100);

const land: GroundOf = () => 'land';
/** Land with a band of something across it, every diamond with `u` from `from` to `to`, but for a gap. */
const band =
  (footing: Footing, from: number, to: number, gap?: { fromV: number; toV: number }): GroundOf =>
  (u, v) =>
    u >= from && u <= to && (gap === undefined || v < gap.fromV || v > gap.toV) ? footing : 'land';

const FRAME = frameOf(GROUND_LATTICE);

/** Whether each diamond of a course is beside the one before it, so it is one unbroken line of ground. */
function unbroken(course: readonly number[]): boolean {
  return course.every((key, at) => {
    if (at === 0) return true;
    const here = diamondOf(key);
    const before = diamondOf(course[at - 1]!);
    return Math.abs(here.u - before.u) + Math.abs(here.v - before.v) === 1;
  });
}

describe('which buildings a path joins', () => {
  it('every two nearer each other than the reach, foot to foot, and no others', () => {
    const pairs = pairsWithin([far, manor, mill], 15).map(([a, b]) => `${a.id}|${b.id}`);
    expect(pairs).toEqual(['structure:manor|structure:mill']);
    expect(pairsWithin([far, manor, mill], 0)).toEqual([]);
  });

  it('are the very pairs measuring every two of them finds, in the same order', () => {
    let seed = 11;
    const next = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    const many = Array.from({ length: 300 }, (_, at) =>
      yard(`structure:${(at * 7919) % 300}`, Math.round(next() * 400) - 200, Math.round(next() * 400) - 200),
    );
    const sorted = [...many].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const every: string[] = [];
    sorted.forEach((a, i) =>
      sorted.slice(i + 1).forEach((b) => {
        if (Math.hypot(a.u - b.u, a.v - b.v) <= 15) every.push(`${a.id}|${b.id}`);
      }),
    );
    expect(every.length).toBeGreaterThan(100);
    expect(pairsWithin(many, 15).map(([a, b]) => `${a.id}|${b.id}`)).toEqual(every);
  });
});

describe("a path's course", () => {
  it('runs unbroken from the front of one footprint to the front of the other', () => {
    const course = courseBetween(mill, manor, land);
    expect(Array.isArray(course)).toBe(true);
    const walked = course as number[];
    const ends = [diamondOf(walked[0]!), diamondOf(walked.at(-1)!)];
    expect(ends).toContainEqual({ u: mill.u - 1, v: mill.v - 1 });
    expect(ends).toContainEqual({ u: manor.u - 1, v: manor.v - 1 });
    expect(unbroken(walked)).toBe(true);
  });

  it('is the same however the pair is asked for, so every page walks the same one', () => {
    expect(courseBetween(manor, mill, land)).toEqual(courseBetween(mill, manor, land));
  });

  it('keeps off open water, going round it by a gap', () => {
    const lake = band('water', 104, 107, { fromV: 90, toV: 91 });
    const course = courseBetween(mill, manor, lake) as number[];
    expect(course.map(diamondOf).every(({ u, v }) => lake(u, v) !== 'water')).toBe(true);
    expect(unbroken(course)).toBe(true);
  });

  it('fords a river where there is no way round, and has none where open water bars every way', () => {
    const river = courseBetween(mill, manor, band('river', 104, 105)) as number[];
    expect(river.some((key) => band('river', 104, 105)(diamondOf(key).u, diamondOf(key).v) === 'river')).toBe(
      true,
    );
    expect(courseBetween(mill, manor, band('water', 104, 105))).toBeNull();
  });

  it('is not walked on ground not known yet', () => {
    expect(courseBetween(mill, manor, (u) => (u > 106 ? null : 'land'))).toBe('unknown');
  });

  it('depends only on its two ends and the ground: a third building beside them moves nothing', () => {
    const between = (paths: ReturnType<typeof pathsOf>) =>
      paths.find((one) => one.between === 'structure:manor|structure:mill')?.diamonds;
    const third = yard('structure:between', 106, 98);
    expect(between(pathsOf([mill, manor, third], 15, land))).toEqual(
      between(pathsOf([mill, manor], 15, land)),
    );
  });
});

describe('paths remembered', () => {
  it('are walked again as more ground comes only when a course waited on ground not known', () => {
    const walk = rememberingPaths();
    const first = walk([mill, manor], 15, land, 0);
    expect(walk([mill, manor], 15, land, 1)).toBe(first);

    let known = false;
    const coming: GroundOf = (u) => (u > 105 && !known ? null : 'land');
    const waiting = walk([mill, manor], 15, coming, 1);
    expect(walk([mill, manor], 15, coming, 1)).toBe(waiting);
    known = true;
    const walked = walk([mill, manor], 15, coming, 2);
    expect(walked).not.toBe(waiting);
    expect(walk([mill, manor], 15, coming, 3)).toBe(walked);
    expect(walk([mill, far], 15, coming, 3)).not.toBe(walked);
  });

  it('walk only the pairs a building that comes or goes is one of', () => {
    const walk = rememberingPaths();
    const first = walk([mill, manor], 15, land, 0);
    expect(walk([mill, manor, far], 15, land, 0)).toBe(first);
    const third = yard('structure:barn', 106, 96);
    const more = walk([mill, manor, far, third], 15, land, 0);
    expect(more.length).toBeGreaterThan(first.length);
    expect(more.find((path) => path.between === first[0]!.between)).toBe(first[0]);
  });
});

describe('paths worn into the worked ground', () => {
  const yards = workedGround([mill, manor]);
  const paths = pathsOf([mill, manor], 15, land);

  it('lie under the yards: a diamond a yard wears stays the yard’s', () => {
    const worn = wearPaths(yards, paths, null);
    for (const [key, kind] of yards) expect(worn.get(key)).toBe(kind);
    expect([...worn.values()].filter((kind) => kind === WORKED.path).length).toBeGreaterThan(0);
  });

  it('are worn only on revealed ground', () => {
    const middleU = (key: number) => {
      const { u, v } = diamondOf(key);
      return { x: worldXOf(FRAME, u + 0.5, v + 0.5), y: worldYOf(FRAME, u + 0.5, v + 0.5) };
    };
    const line = worldXOf(FRAME, 106, 102);
    const worn = wearPaths(yards, paths, (x) => x < line);
    for (const [key, kind] of worn) {
      if (kind === WORKED.path) expect(middleU(key).x).toBeLessThan(line);
    }
    expect(wearPaths(yards, paths, () => false)).toBe(yards);
  });

  it('leave the worked ground as it was when there are none', () => {
    expect(wearPaths(yards, [], null)).toBe(yards);
    expect(diamondKey(0, 0)).toBe(diamondKey(0, 0));
  });
});

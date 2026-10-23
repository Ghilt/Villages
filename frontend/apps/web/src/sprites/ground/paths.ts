import { GROUND_LATTICE, frameOf, worldXOf, worldYOf } from '@villages/world';

import { WORKED } from './worked';
import type { Worked } from './worked';
import { diamondKey, diamondOf } from './workedGround';
import type { Yard } from './workedGround';

const FRAME = frameOf(GROUND_LATTICE);

/*
 * Paths: worked ground joining two buildings nearer each other than the paths' reach, whoever holds them, a ruin
 * included. Which two are joined is the pair's own business - nearer than the reach or not - so learning of a third
 * building never adds, moves or takes away a path already seen, as a rule like "each to its nearest" would the moment
 * the fog let a nearer one through. The course is walked over the diamonds from one foot to the other, the cheapest
 * way across the ground between them: open water never, a river at a cost, and a gentle wander seeded by the pair, so
 * every page that holds the two buildings and knows the ground walks the same one. See docs/plans/worked-ground.md.
 */

/** What a diamond of ground is, for a path: land to walk, a river to ford, water to keep off, or not known yet. */
export type Footing = 'land' | 'river' | 'water' | null;

/** The ground under a diamond of the lattice, by its two whole numbers. */
export type GroundOf = (u: number, v: number) => Footing;

/** A path, by the two buildings it joins, and the diamonds it is walked over, by `diamondKey`. */
export interface Path {
  between: string;
  diamonds: readonly number[];
}

/** What a step onto a river costs beside one onto land: a ford is worth a detour, but not a long one. */
const FORD = 6;
/** How much the wander can add to a step, and how wide its bends are, in diamonds. */
const WANDER = 0.9;
const BEND = 5;

/** A number for a string, FNV-1a, the seed of a pair's wander. */
function seedOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(at), 0x01000193);
  }
  return hash >>> 0;
}

function hash(seed: number, u: number, v: number): number {
  let h = seed ^ Math.imul(u, 0x27d4eb2d) ^ Math.imul(v, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** A smooth noise over the lattice, nought to one, its hills `BEND` diamonds apart: what makes a course bend. */
function wander(seed: number, u: number, v: number): number {
  const fu = u / BEND;
  const fv = v / BEND;
  const iu = Math.floor(fu);
  const iv = Math.floor(fv);
  const tu = fu - iu;
  const tv = fv - iv;
  const su = tu * tu * (3 - 2 * tu);
  const sv = tv * tv * (3 - 2 * tv);
  const top = hash(seed, iu, iv) * (1 - su) + hash(seed, iu + 1, iv) * su;
  const bottom = hash(seed, iu, iv + 1) * (1 - su) + hash(seed, iu + 1, iv + 1) * su;
  return top * (1 - sv) + bottom * sv;
}

/**
 * Every two yards nearer each other than the reach, foot to foot, in the order of their ids. Each yard is set in a grid
 * a reach across and measured only against the yards of the cells about it, not against every other yard there is.
 */
export function pairsWithin(yards: readonly Yard[], reach: number): [Yard, Yard][] {
  const sorted = [...yards].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const cell = Math.max(reach, 1);
  const key = (cu: number, cv: number) => (cv + 100_000) * 200_000 + cu + 100_000;
  const grid = new Map<number, number[]>();
  sorted.forEach((yard, at) => {
    const here = key(Math.floor(yard.u / cell), Math.floor(yard.v / cell));
    const list = grid.get(here);
    if (list === undefined) grid.set(here, [at]);
    else list.push(at);
  });
  const pairs: [Yard, Yard][] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i]!;
    const cu = Math.floor(a.u / cell);
    const cv = Math.floor(a.v / cell);
    const near: number[] = [];
    for (let dv = -1; dv <= 1; dv += 1) {
      for (let du = -1; du <= 1; du += 1) {
        for (const j of grid.get(key(cu + du, cv + dv)) ?? []) {
          if (j > i && Math.hypot(a.u - sorted[j]!.u, a.v - sorted[j]!.v) <= reach) near.push(j);
        }
      }
    }
    near.sort((x, y) => x - y);
    for (const j of near) pairs.push([a, sorted[j]!]);
  }
  return pairs;
}

/** The stretch of the lattice a pair's course may be walked in: both footprints and a margin as wide as the gap. */
export function boxOf(a: Yard, b: Yard): { fromU: number; toU: number; fromV: number; toV: number } {
  const margin = Math.ceil(Math.hypot(a.u - b.u, a.v - b.v)) + 2;
  return {
    fromU: Math.min(a.u - a.side, b.u - b.side) - margin,
    toU: Math.max(a.u, b.u) + margin,
    fromV: Math.min(a.v - a.side, b.v - b.side) - margin,
    toV: Math.max(a.v, b.v) + margin,
  };
}

/** A binary heap of diamonds by what they cost, the cheaper first, the lower key first between two the same. */
class Frontier {
  private readonly items: { key: number; cost: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(key: number, cost: number): void {
    const items = this.items;
    items.push({ key, cost });
    let at = items.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (!this.before(items[at]!, items[parent]!)) break;
      [items[at], items[parent]] = [items[parent]!, items[at]!];
      at = parent;
    }
  }

  pop(): { key: number; cost: number } {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        const right = left + 1;
        let least = at;
        if (left < items.length && this.before(items[left]!, items[least]!)) least = left;
        if (right < items.length && this.before(items[right]!, items[least]!)) least = right;
        if (least === at) break;
        [items[at], items[least]] = [items[least]!, items[at]!];
        at = least;
      }
    }
    return top;
  }

  private before(one: { key: number; cost: number }, other: { key: number; cost: number }): boolean {
    return one.cost < other.cost || (one.cost === other.cost && one.key < other.key);
  }
}

/**
 * The course between two buildings: the diamonds walked from the front of one footprint to the front of the other,
 * the cheapest way across the ground in their box, a step onto land costing one and a little of the pair's wander, a
 * ford `FORD`, and open water never. Null when water bars every way in the box; 'unknown' while some of the ground it
 * looked at is not known yet, so a course is never walked on a guess and walked again differently a moment later.
 */
export function courseBetween(a: Yard, b: Yard, ground: GroundOf): number[] | null | 'unknown' {
  const [first, second] = a.id < b.id ? [a, b] : [b, a];
  const seed = seedOf(`${first.id}|${second.id}`);
  const box = boxOf(first, second);
  const from = { u: first.u - 1, v: first.v - 1 };
  const to = { u: second.u - 1, v: second.v - 1 };
  const goal = diamondKey(to.u, to.v);
  const spent = new Map<number, number>([[diamondKey(from.u, from.v), 0]]);
  const came = new Map<number, number>();
  const frontier = new Frontier();
  frontier.push(diamondKey(from.u, from.v), 0);
  const where = new Map<number, { u: number; v: number }>([[diamondKey(from.u, from.v), from]]);
  while (frontier.size > 0) {
    const { key } = frontier.pop();
    if (key === goal) {
      const course = [key];
      for (let at = came.get(key); at !== undefined; at = came.get(at)) course.push(at);
      return course.reverse();
    }
    const here = where.get(key)!;
    const cost = spent.get(key)!;
    for (const [du, dv] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const u = here.u + du;
      const v = here.v + dv;
      if (u < box.fromU || u > box.toU || v < box.fromV || v > box.toV) continue;
      const footing = ground(u, v);
      if (footing === null) {
        return 'unknown';
      }
      if (footing === 'water') continue;
      const step = footing === 'river' ? FORD : 1 + WANDER * wander(seed, u, v);
      const next = diamondKey(u, v);
      const total = cost + step;
      if (total < (spent.get(next) ?? Infinity)) {
        spent.set(next, total);
        came.set(next, key);
        where.set(next, { u, v });
        frontier.push(next, total + Math.abs(to.u - u) + Math.abs(to.v - v));
      }
    }
  }
  return null;
}

/**
 * Every path between the yards: each pair nearer than the reach, walked over the ground. A pair whose ground is not
 * all known yet is left out until it is, and one that water bars has none.
 */
export function pathsOf(yards: readonly Yard[], reach: number, ground: GroundOf): Path[] {
  const paths: Path[] = [];
  for (const [a, b] of pairsWithin(yards, reach)) {
    const course = courseBetween(a, b, ground);
    if (Array.isArray(course)) {
      paths.push({ between: `${a.id}|${b.id}`, diamonds: course });
    }
  }
  return paths;
}

/**
 * The worked ground with the paths worn into it, under the yards: a diamond a yard wears stays the yard's. A path is
 * worn only where `revealed` says the house has seen, a point of world space at a time - everywhere with the fog off,
 * which is null - so a path to a building seen through the fog stops where the revealed ground stops. The worked
 * ground itself when no path adds a diamond, so the scenery is not sorted again for nothing.
 */
export function wearPaths(
  worked: ReadonlyMap<number, Worked>,
  paths: readonly Path[],
  revealed: ((x: number, y: number) => boolean) | null,
): ReadonlyMap<number, Worked> {
  const worn = new Map(worked);
  for (const path of paths) {
    for (const key of path.diamonds) {
      if (worn.has(key)) continue;
      const { u, v } = diamondOf(key);
      if (
        revealed !== null &&
        !revealed(worldXOf(FRAME, u + 0.5, v + 0.5), worldYOf(FRAME, u + 0.5, v + 0.5))
      ) {
        continue;
      }
      worn.set(key, WORKED.path);
    }
  }
  return worn.size === worked.size ? worked : worn;
}

/**
 * `pathsOf` that remembers each pair's course, so a course is walked again only when one of its two buildings comes,
 * goes or changes, or more of the ground comes in (`version`) while that course waited on ground not known yet; and
 * hands back the very paths it handed back last while every one of them is the same. Not each time a person on the map
 * takes a step, a tile of ground comes in for somebody else, or one building more makes every path walked again
 * (decision record 0118).
 */
export function rememberingPaths(): (
  yards: readonly Yard[],
  reach: number,
  ground: GroundOf,
  version: number,
) => readonly Path[] {
  let last: {
    yards: readonly Yard[];
    ground: GroundOf;
    reach: number;
    version: number;
    waiting: boolean;
    paths: Path[];
  } | null = null;
  let walked = new Map<string, { version: number; path: Path | null | 'unknown' }>();
  const yardKey = (yard: Yard) => `${yard.id} ${yard.u} ${yard.v} ${yard.side}`;
  const sameYard = (a: Yard, b: Yard) => a.id === b.id && a.u === b.u && a.v === b.v && a.side === b.side;
  return (yards, reach, ground, version) => {
    // The buildings handed in again on every step a person on the map takes: the very same yards ask nothing new.
    if (
      last?.ground === ground &&
      last.reach === reach &&
      (last.version === version || !last.waiting) &&
      last.yards.length === yards.length &&
      yards.every((yard, at) => sameYard(yard, last!.yards[at]!))
    ) {
      return last.paths;
    }
    if (last !== null && (last.ground !== ground || last.reach !== reach)) walked = new Map();
    const next = new Map<string, { version: number; path: Path | null | 'unknown' }>();
    const paths: Path[] = [];
    for (const [a, b] of pairsWithin(yards, reach)) {
      const pair = `${yardKey(a)}|${yardKey(b)}`;
      let was = walked.get(pair);
      if (was === undefined || (was.path === 'unknown' && was.version !== version)) {
        const course = courseBetween(a, b, ground);
        was = {
          version,
          path: Array.isArray(course) ? { between: `${a.id}|${b.id}`, diamonds: course } : course,
        };
      }
      next.set(pair, was);
      if (was.path !== null && was.path !== 'unknown') paths.push(was.path);
    }
    walked = next;
    const before = last?.paths;
    const same = before?.length === paths.length && paths.every((path, at) => path === before[at]);
    const waiting = [...next.values()].some((one) => one.path === 'unknown');
    last = { yards, ground, reach, version, waiting, paths: same ? before! : paths };
    return last.paths;
  };
}

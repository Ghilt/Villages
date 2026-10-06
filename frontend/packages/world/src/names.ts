import { simplify } from './simplify.ts';

/**
 * Earth's named rivers, lakes and peaks, carried into the world through the origin map, and the question a
 * page asks of them: what is named here? See `docs/plans/real-world-names.md`.
 *
 * The names are the sources' own, today's, and not yet the ones of 1790: choosing those is a review of its
 * own. Every one is keyed by the source's identity of it - a Wikidata id where there is one - so that it keeps
 * its name when Adam repaints, and it lands wherever its ground went. Ground he removed or copied takes it
 * nowhere; a river is broken where it leaves Earth's ground or where Adam cut through it, and each run of it
 * keeps the name.
 */

export type NameKind = 'river' | 'lake' | 'peak';

/** A named thing on plain Earth, in Earth's longitude and latitude, as a source gives it. */
export interface EarthName {
  readonly id: string;
  readonly kind: NameKind;
  readonly name: string;
  /** The English name, where the source gives one and it differs. */
  readonly english?: string;
  /** Metres, for a peak. */
  readonly elevation?: number;
  /** A river's runs, a lake's outlines, or a peak's one point, as `[longitude, latitude]`. */
  readonly lines: readonly (readonly (readonly [number, number])[])[];
}

/** A named thing in the world, in the world's own longitude and latitude. */
export interface WorldName {
  readonly id: string;
  readonly kind: NameKind;
  readonly name: string;
  readonly english?: string;
  readonly elevation?: number;
  /** Where its name would be written: a peak's top, the middle of a river's longest run, a lake's middle. */
  readonly at: readonly [number, number];
  /** A river's runs, a lake's outlines carried whole, or nothing for a peak. */
  readonly lines: readonly (readonly (readonly [number, number])[])[];
}

/** Where a point of Earth went in the world, or null where it went nowhere. Longitude and latitude both ways. */
export type Carry = (lng: number, lat: number) => [number, number] | null;

/**
 * Carries every name, and says how many went nowhere. `tolerance` is in degrees: how far a carried line may
 * stray from the points it drops, which is what keeps a world's worth of rivers to a file a page can read.
 */
export function carryNames(
  names: readonly EarthName[],
  carry: Carry,
  tolerance = 0.01,
): { carried: WorldName[]; lost: number } {
  const carried: WorldName[] = [];
  let lost = 0;
  for (const name of names) {
    const runs = name.lines.flatMap((line) => carryLine(line, carry, name.kind === 'lake'));
    const kept = runs
      .map((run) =>
        simplify(
          run.map(([x, y]) => ({ x, y })),
          tolerance,
        ).map(({ x, y }) => [round(x), round(y)] as const),
      )
      .filter((run) => run.length >= (name.kind === 'peak' ? 1 : 2));
    if (kept.length === 0) {
      lost += 1;
      continue;
    }
    const longest = kept.reduce((best, run) => (run.length > best.length ? run : best));
    const at = name.kind === 'lake' ? middleOf(kept.flat()) : longest[Math.floor(longest.length / 2)]!;
    carried.push({
      id: name.id,
      kind: name.kind,
      name: name.name,
      ...(name.english === undefined || name.english === name.name ? {} : { english: name.english }),
      ...(name.elevation === undefined ? {} : { elevation: name.elevation }),
      at,
      lines: name.kind === 'peak' ? [] : kept,
    });
  }
  return { carried, lost };
}

/**
 * One line carried point by point, broken where a point goes nowhere or where two points beside each other on
 * Earth land far apart in the world, which is a seam Adam cut. A lake's outline is kept whole, stepping over
 * the odd point of shore that went nowhere, or not kept at all: half a shore is not a lake.
 */
function carryLine(
  line: readonly (readonly [number, number])[],
  carry: Carry,
  whole: boolean,
): [number, number][][] {
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  let before: readonly [number, number] | null = null;
  let missing = 0;
  for (const point of line) {
    const there = carry(point[0], point[1]);
    if (there === null) {
      missing += 1;
      if (whole && missing > MOST_SHORE_MISSING * line.length) return [];
      if (whole) continue;
      if (run.length > 0) runs.push(run);
      run = [];
      before = null;
      continue;
    }
    const last = run[run.length - 1];
    if (last !== undefined && before !== null) {
      const onEarth = Math.hypot(point[0] - before[0], point[1] - before[1]);
      const inWorld = Math.hypot(there[0] - last[0], there[1] - last[1]);
      if (inWorld > 3 * onEarth + 0.05) {
        if (whole) return [];
        runs.push(run);
        run = [];
      }
    }
    run.push(there);
    before = point;
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/** The share of a lake's shore that may go nowhere before the lake is taken to have gone with it. */
const MOST_SHORE_MISSING = 0.05;

function middleOf(points: readonly (readonly [number, number])[]): [number, number] {
  let lng = 0;
  let lat = 0;
  for (const [x, y] of points) {
    lng += x;
    lat += y;
  }
  return [round(lng / points.length), round(lat / points.length)];
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** How near a thing must be, in kilometres, to be the one a place is by, in or near. */
const BY_A_RIVER = 6;
const BY_A_LAKE = 2;
const NEAR_A_PEAK = 30;

/** What is named at a place in the world: the river it is by, the lake it is in or by, the peak it is near. */
export function namesAt(
  names: readonly WorldName[],
  lng: number,
  lat: number,
): { river?: WorldName; lake?: WorldName; peak?: WorldName } {
  const found: { river?: WorldName; lake?: WorldName; peak?: WorldName } = {};
  const nearest = { river: BY_A_RIVER, lake: BY_A_LAKE, peak: NEAR_A_PEAK };
  const across = 111.32 * Math.cos((lat * Math.PI) / 180);
  for (const name of names) {
    let distance: number;
    if (name.kind === 'peak') {
      distance = Math.hypot((name.at[0] - lng) * across, (name.at[1] - lat) * 111.32);
    } else {
      distance = Infinity;
      for (const line of name.lines) {
        if (name.kind === 'lake' && inside(line, lng, lat)) distance = 0;
        for (let at = 1; at < line.length; at += 1) {
          distance = Math.min(distance, toSegment(line[at - 1]!, line[at]!, lng, lat, across));
        }
      }
    }
    if (distance <= nearest[name.kind]) {
      nearest[name.kind] = distance;
      found[name.kind] = name;
    }
  }
  return found;
}

function toSegment(
  from: readonly [number, number],
  to: readonly [number, number],
  lng: number,
  lat: number,
  across: number,
): number {
  const ax = (from[0] - lng) * across;
  const ay = (from[1] - lat) * 111.32;
  const bx = (to[0] - lng) * across;
  const by = (to[1] - lat) * 111.32;
  const run = bx - ax;
  const rise = by - ay;
  const length = run * run + rise * rise;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, -(ax * run + ay * rise) / length));
  return Math.hypot(ax + t * run, ay + t * rise);
}

function inside(ring: readonly (readonly [number, number])[], lng: number, lat: number): boolean {
  let within = false;
  for (let at = 0, before = ring.length - 1; at < ring.length; before = at, at += 1) {
    const [x1, y1] = ring[at]!;
    const [x2, y2] = ring[before]!;
    if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) within = !within;
  }
  return within;
}

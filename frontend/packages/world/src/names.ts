import { simplify } from './simplify.ts';

/**
 * Earth's named rivers, lakes, peaks and towns, carried into the world through the origin map, and the
 * question a page asks of them: what is named here? See `docs/plans/real-world-names.md`.
 *
 * Every name is in English, Adam's choice of 2026-10-06. A town's is the one an English writer of 1790 would
 * have used, from the review in `world/names/1790.json`; a river's, lake's or peak's is today's English name,
 * until a review gives it its 1790 one. Every one is keyed by the source's identity of it - a Wikidata id
 * where there is one - so that it keeps its name when Adam repaints, and it lands wherever its ground went.
 * Ground he removed or copied takes it nowhere; a river is broken where it leaves Earth's ground or where Adam
 * cut through it, and each run of it keeps the name.
 */

export type NameKind = 'river' | 'lake' | 'peak' | 'town';

/** How sure a name is of being the one used in 1790: reviewed for it, or today's until it is. */
export type NameForm = '1790' | 'today';

/** A named thing on plain Earth, in Earth's longitude and latitude, as a source gives it. */
export interface EarthName {
  readonly id: string;
  readonly kind: NameKind;
  /** The name to show, in English. */
  readonly name: string;
  /** Another name worth knowing: a town's today, where it differs; a river's own, where English has another. */
  readonly also?: string;
  /** Metres, for a peak. */
  readonly elevation?: number;
  /** How much the thing matters, from 0 the most: the source's own rank, which for now is today's. */
  readonly rank?: number;
  /** The zoom from which the thing is worth naming on a map, the source's own judgement. */
  readonly from?: number;
  readonly form?: NameForm;
  /** A river's runs, a lake's outlines, or a peak's one point, as `[longitude, latitude]`. */
  readonly lines: readonly (readonly (readonly [number, number])[])[];
}

/**
 * A named thing in the world, in the world's own longitude and latitude: what a page draws and what a quest
 * or a line of flavour names. `id` is the real world's identity of it and never changes; `earth` is where on
 * Earth its name stands, which is how the history of a real place will find it.
 */
export interface WorldName {
  readonly id: string;
  readonly kind: NameKind;
  readonly name: string;
  readonly also?: string;
  readonly elevation?: number;
  readonly rank?: number;
  readonly from?: number;
  readonly form: NameForm;
  /** Where its name would be written: a peak's top, the middle of a river's longest run, a lake's middle. */
  readonly at: readonly [number, number];
  /** The same place on Earth, before it was carried. */
  readonly earth: readonly [number, number];
  /** A river's runs, a lake's outlines carried whole, or nothing for a peak. */
  readonly lines: readonly (readonly (readonly [number, number])[])[];
}

/** Where a point of Earth went in the world, or null where it went nowhere. Longitude and latitude both ways. */
export type Carry = (lng: number, lat: number) => [number, number] | null;

/** One unbroken run of a line, carried: each point in the world, and where it was on Earth. */
interface Run {
  readonly world: [number, number][];
  readonly earth: (readonly [number, number])[];
}

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
    const runs = name.lines
      .flatMap((line) => carryLine(line, carry, name.kind === 'lake'))
      .filter((run) => run.world.length >= (isPoint(name.kind) ? 1 : 2));
    if (runs.length === 0) {
      lost += 1;
      continue;
    }
    // A name goes in the middle of the longest run, or of a lake's whole shore, in both worlds alike.
    const longest = runs.reduce((best, run) => (run.world.length > best.world.length ? run : best));
    const middle = Math.floor(longest.world.length / 2);
    const lake = name.kind === 'lake';
    const at = lake ? middleOf(runs.flatMap((run) => run.world)) : rounded(longest.world[middle]!);
    const earth = lake ? middleOf(runs.flatMap((run) => run.earth)) : rounded(longest.earth[middle]!);
    carried.push({
      id: name.id,
      kind: name.kind,
      name: name.name,
      ...(name.also === undefined || name.also === name.name ? {} : { also: name.also }),
      ...(name.elevation === undefined ? {} : { elevation: name.elevation }),
      ...(name.rank === undefined ? {} : { rank: name.rank }),
      ...(name.from === undefined ? {} : { from: name.from }),
      form: name.form ?? 'today',
      at,
      earth,
      lines: isPoint(name.kind)
        ? []
        : runs.map((run) =>
            simplify(
              run.world.map(([x, y]) => ({ x, y })),
              tolerance,
            ).map(({ x, y }) => [round(x), round(y)] as const),
          ),
    });
  }
  return { carried, lost };
}

/**
 * One line carried point by point, broken where a point goes nowhere or where two points beside each other on
 * Earth land far apart in the world, which is a seam Adam cut. A lake's outline is kept whole, stepping over
 * the odd point of shore that went nowhere, or not kept at all: half a shore is not a lake.
 */
function carryLine(line: readonly (readonly [number, number])[], carry: Carry, whole: boolean): Run[] {
  const runs: Run[] = [];
  let run: Run = { world: [], earth: [] };
  let missing = 0;
  for (const point of line) {
    const there = carry(point[0], point[1]);
    if (there === null) {
      missing += 1;
      if (whole && missing > MOST_SHORE_MISSING * line.length) return [];
      if (whole) continue;
      if (run.world.length > 0) runs.push(run);
      run = { world: [], earth: [] };
      continue;
    }
    const last = run.world[run.world.length - 1];
    const before = run.earth[run.earth.length - 1];
    if (last !== undefined && before !== undefined) {
      const onEarth = Math.hypot(point[0] - before[0], point[1] - before[1]);
      const inWorld = Math.hypot(there[0] - last[0], there[1] - last[1]);
      if (inWorld > 3 * onEarth + 0.05) {
        if (whole) return [];
        runs.push(run);
        run = { world: [], earth: [] };
      }
    }
    run.world.push(there);
    run.earth.push(point);
  }
  if (run.world.length > 0) runs.push(run);
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

function rounded([lng, lat]: readonly [number, number]): [number, number] {
  return [round(lng), round(lat)];
}

/** A peak and a town are points; a river and a lake are lines. */
function isPoint(kind: NameKind): boolean {
  return kind === 'peak' || kind === 'town';
}

/** How near a thing must be, in kilometres, to be the one a place is by, in or near. */
const BY_A_RIVER = 6;
const BY_A_LAKE = 2;
const NEAR_A_PEAK = 30;
const NEAR_A_TOWN = 25;

/** What is named at a place in the world: the river it is by, the lake it is in or by, the peak it is near. */
export function namesAt(
  names: readonly WorldName[],
  lng: number,
  lat: number,
): { [kind in NameKind]?: WorldName } {
  const found: { [kind in NameKind]?: WorldName } = {};
  const nearest = { river: BY_A_RIVER, lake: BY_A_LAKE, peak: NEAR_A_PEAK, town: NEAR_A_TOWN };
  const across = 111.32 * Math.cos((lat * Math.PI) / 180);
  for (const name of names) {
    let distance: number;
    if (isPoint(name.kind)) {
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

/** A thing as the review of 1790 decides it: its name then, or null if it was not there; today's; and why. */
export type Reviewed = readonly [string | null, string, string?];

/**
 * What a source's named thing is called in the world, as the review in `world/names/1790.json` decides: the
 * review's name of 1790 where it has one, else the source's English name, else its own; the other name worth
 * showing beside that; and whether it is the name of 1790. A sea or a stretch of land is named the same way. Null
 * where the review says the thing was not there in 1790, and for a canal or a reservoir the review has not dated,
 * `made` saying the source calls it one: Natural Earth files its canals as rivers and its reservoirs as lakes, and
 * most of both - Suez, Panama, the Caledonian, Lake Nasser, the Rybinsk sea - were made after 1790.
 */
export function asIn1790(
  kind: NameKind | 'sea' | 'land',
  english: string | undefined,
  local: string,
  decided: Reviewed | undefined,
  made = false,
): { name: string; also?: string; form?: '1790' } | null {
  const name = decided?.[0] ?? (kind === 'lake' ? lakeInEnglish(english, local) : english) ?? local;
  const dug = made || (kind === 'river' && /\bcanal\b/i.test(`${name} ${local}`));
  if (decided?.[0] === null || (decided === undefined && dug)) return null;
  const other = alsoOf(name, local, decided);
  // Lake Mälaren needs no Mälaren beside it.
  const also = kind === 'lake' && other !== undefined && within(other, name) ? undefined : other;
  return {
    name,
    ...(also === undefined ? {} : { also }),
    ...(decided === undefined ? {} : { form: '1790' as const }),
  };
}

/**
 * A lake as English writes it. Natural Earth gives a lake's English name as its bare stem - Erie, Woods, Constance -
 * so the source's own name is the English one where it says lake itself, Lake Erie, Lake of the Woods, Great Bear
 * Lake, Lough Neagh; and a stem saying nothing of water is a Lake, Lake Constance beside the Bodensee.
 */
function lakeInEnglish(english: string | undefined, local: string): string | undefined {
  if (wordsOf(local).some((word) => ENGLISH_LAKE.has(word))) return local;
  if (english === undefined) return undefined;
  return wordsOf(english).some((word) => WATER.has(word)) ? english : `Lake ${english}`;
}

/** The words that make a name an English lake's. */
const ENGLISH_LAKE = new Set(['lake', 'lakes', 'loch', 'lough']);

/** Words that say a name is already a water's, in English or the language it is named in. */
const WATER = new Set([
  ...ENGLISH_LAKE,
  ...[
    'sea',
    'bay',
    'channel',
    'sound',
    'inlet',
    'arm',
    'basin',
    'strait',
    'river',
    'reservoir',
    'pond',
    'lagoon',
  ],
  ...[
    'lago',
    'lac',
    'laguna',
    'lagoa',
    'ozero',
    'see',
    'meer',
    'zee',
    'haff',
    'zaliv',
    'zalew',
    'jezioro',
    'jezero',
  ],
  ...[
    'hu',
    'nuur',
    'nur',
    'co',
    'tso',
    'kul',
    'köl',
    'köli',
    'göl',
    'gölü',
    'järvi',
    'jarvi',
    'vatn',
    'vatnet',
  ],
  ...[
    'sjön',
    'sjøen',
    'träsk',
    'tó',
    'yumco',
    'embalse',
    'represa',
    'presa',
    'dam',
    'shuiku',
    'sagar',
    'samudra',
  ],
  ...['limni', 'étang', 'salar', 'chott', 'danau', 'buhayrat'],
]);

/** A name's words, in small letters, whatever the alphabet. */
function wordsOf(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Whether one name's words stand together in another's: Mälaren in Lake Mälaren. */
function within(one: string, other: string): boolean {
  return ` ${wordsOf(other).join(' ')} `.includes(` ${wordsOf(one).join(' ')} `);
}

/**
 * The other name worth showing beside a thing's: today's from the review where it differs, else the source's own -
 * but never the same name again, nor one the source has mangled, its letters lost (Klarlven) or turned to '?'.
 */
function alsoOf(name: string, local: string, decided: Reviewed | undefined): string | undefined {
  // Letters alone, so that a name with its accented letters lost reads as the one it lost them from.
  const plain = (one: string) => one.toLowerCase().replace(/[^a-z]/g, '');
  const clean = [name, ...(decided ?? [])].filter((one): one is string => typeof one === 'string');
  const garbled = (one: string) =>
    one.includes('?') || clean.some((other) => other !== one && plain(other) === plain(one));
  return [decided?.[1], local].find(
    (one): one is string => one !== undefined && one !== name && !garbled(one),
  );
}

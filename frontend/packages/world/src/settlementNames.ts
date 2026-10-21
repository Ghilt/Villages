import type { WorldName } from './names.ts';
import type { SettlementType } from './settlements.ts';

/*
 * What a settlement is called: its place, as an atlas would put it - the culture's word for it, and the nearest named
 * water or ruin. A fishing village is on the lake, the sea or the river it fishes; a village beside a ruin is by the
 * ruins of its town; any other is by the river or the lake near it, or in the land it stands in. Adam's word of
 * 2026-10-21: *fishing village on the Lake of Geneva*, *village by the ruins of Dantzic*. See
 * docs/plans/settlements-and-roads.md.
 */

/** How far a settlement looks for the water it is named by, in kilometres. */
const FOR_A_FISHING_VILLAGE = 14;
const FOR_A_VILLAGE = 15;
/** The longest name, which a window's title holds. */
const LONGEST = 80;

/** A named region as the names file has it: what it is, a sea or a land. */
export interface Region {
  readonly name: string;
  readonly kind: 'sea' | 'land';
  readonly feature?: string;
}

/** The regions every square of the origin map is in and by: `regions.bin`, two layers of sixteen bits, land first. */
export interface RegionSquares {
  readonly columns: number;
  readonly rows: number;
  readonly bytes: Uint8Array;
  readonly regions: readonly Region[];
}

/**
 * A settlement to be named: its type, the town of 1790 it stands beside if any and whether it is the first of that
 * town's, and where it stands.
 */
export interface ToName {
  readonly type: SettlementType;
  readonly by: string | null;
  readonly first: boolean;
  readonly lng: number;
  readonly lat: number;
}

type Segment = readonly [number, number, number, number, WorldName];

const CELL = 0.5;

/** Kilometres between two places near each other, flat. */
function km(lng: number, lat: number, toLng: number, toLat: number): number {
  const across = 111.32 * Math.cos((lat * Math.PI) / 180);
  return Math.hypot((toLng - lng) * across, (toLat - lat) * 111.32);
}

function toSegment(segment: Segment, lng: number, lat: number): number {
  const across = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ax = (segment[0] - lng) * across;
  const ay = (segment[1] - lat) * 111.32;
  const bx = (segment[2] - lng) * across;
  const by = (segment[3] - lat) * 111.32;
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

/** A name as an English sentence says it after "by" or "on": the Loire, the Lake of Geneva, Lake Eğirdir. */
export function asPlace(name: string, feature = ''): string {
  if (/^(the|The) /.test(name) || /'s\b/.test(name)) return name;
  if (/^(Lake|Lago|Lac|Loch|Ozero|Mount|Cape|Jabal|Jebel) /.test(name) && !/^Lake of /.test(name))
    return name;
  if (/(Bay|Sound|Inlet)$/.test(name) && !/ of /.test(name)) return name;
  if (/^(Continent|Geoarea)$/.test(feature)) return name;
  if (feature === 'Island' && !/(Islands|Isles|Archipelago)$/.test(name)) return name;
  return `the ${name}`;
}

/** Whether a settlement stands on a land, as on an island or a cape, rather than in it. */
function standsOn(region: Region): boolean {
  return (
    /^(Island|Island group|Pen\/cape|Peninsula|Isthmus)$/.test(region.feature ?? '') ||
    /Coast$/.test(region.name)
  );
}

/** Names settlements from the names a master carries and the regions its squares are in. */
export class SettlementNamer {
  private readonly cells = new Map<string, Segment[]>();
  private readonly towns = new Map<string, WorldName>();
  private readonly lakes: WorldName[];
  private readonly squares: RegionSquares | null;

  constructor(names: readonly WorldName[], squares: RegionSquares | null) {
    this.squares = squares;
    this.lakes = names.filter((one) => one.kind === 'lake');
    for (const one of names) {
      if (one.kind === 'town') this.towns.set(one.id, one);
      if (one.kind !== 'river' && one.kind !== 'lake') continue;
      for (const line of one.lines) {
        for (let at = 1; at < line.length; at += 1) {
          const [x1, y1] = line[at - 1]!;
          const [x2, y2] = line[at]!;
          const segment: Segment = [x1, y1, x2, y2, one];
          for (
            let cy = Math.floor(Math.min(y1, y2) / CELL);
            cy <= Math.floor(Math.max(y1, y2) / CELL);
            cy += 1
          ) {
            for (
              let cx = Math.floor(Math.min(x1, x2) / CELL);
              cx <= Math.floor(Math.max(x1, x2) / CELL);
              cx += 1
            ) {
              const key = `${cx}:${cy}`;
              const here = this.cells.get(key);
              if (here === undefined) this.cells.set(key, [segment]);
              else here.push(segment);
            }
          }
        }
      }
    }
  }

  /** What a settlement is called, its culture's `word` for its type first. */
  nameOf(site: ToName, word: string): string {
    const town = site.by === null ? undefined : this.towns.get(site.by);
    const byTheRuins = town === undefined ? null : `${word} by the ruins of ${town.name}`;
    // A ruin's first village is called after it, a fishing village after the water it fishes, and the rest after the
    // water or the land about them, or after the ruin where nothing about them has a name.
    const name =
      byTheRuins !== null && site.first
        ? byTheRuins
        : site.type === 'fishingVillage'
          ? this.fishing(site, word, byTheRuins)
          : this.village(site, word, byTheRuins);
    return name.length <= LONGEST ? name : word;
  }

  private fishing(site: ToName, word: string, otherwise: string | null): string {
    const lake = this.nearest(site, 'lake', FOR_A_FISHING_VILLAGE);
    if (lake !== null) return `${word} on ${asPlace(lake.name)}`;
    const sea = this.region(site, 'sea', 1);
    if (sea !== null) return `${word} on ${asPlace(sea.name, sea.feature)}`;
    const river = this.nearest(site, 'river', FOR_A_FISHING_VILLAGE);
    if (river !== null) return `${word} on ${asPlace(river.name)}`;
    return this.village(site, word, otherwise);
  }

  private village(site: ToName, word: string, otherwise: string | null): string {
    const water = this.nearest(site, 'river', FOR_A_VILLAGE) ?? this.nearest(site, 'lake', FOR_A_VILLAGE);
    if (water !== null) return `${word} by ${asPlace(water.name)}`;
    if (otherwise !== null) return otherwise;
    const land = this.region(site, 'land');
    if (land !== null) return `${word} ${standsOn(land) ? 'on' : 'in'} ${asPlace(land.name, land.feature)}`;
    return word;
  }

  /** The named river or lake of a kind nearest a place within `within` kilometres; a lake it stands in at nought. */
  private nearest(site: ToName, kind: 'river' | 'lake', within: number): WorldName | null {
    let best: WorldName | null = null;
    let nearest = within;
    if (kind === 'lake') {
      for (const lake of this.lakes) {
        if (
          km(site.lng, site.lat, lake.at[0], lake.at[1]) < 400 &&
          lake.lines.some((ring) => inside(ring, site.lng, site.lat))
        ) {
          return lake;
        }
      }
    }
    const cx = Math.floor(site.lng / CELL);
    const cy = Math.floor(site.lat / CELL);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (const segment of this.cells.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (segment[4].kind !== kind) continue;
          const distance = toSegment(segment, site.lng, site.lat);
          if (distance < nearest || (distance === nearest && best !== null && segment[4].id < best.id)) {
            nearest = distance;
            best = segment[4];
          }
        }
      }
    }
    return best;
  }

  /** The sea a place is by, or the land it is in, by its square of the origin map, or null where none is named. */
  private region(site: ToName, kind: 'sea' | 'land', around = 0): Region | null {
    if (this.squares === null) return null;
    const { columns, rows, bytes, regions } = this.squares;
    const column = Math.floor(((site.lng + 180) / 360) * columns);
    const row = Math.floor(((90 - site.lat) / 180) * rows);
    const layer = kind === 'land' ? 0 : columns * rows;
    // Its own square first, then the ring about it, nearest first: a coast's square may have land and no sea named.
    for (let ring = 0; ring <= around; ring += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        for (let dx = -ring; dx <= ring; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const y = Math.min(rows - 1, Math.max(0, row + dy));
          const x = (((column + dx) % columns) + columns) % columns;
          const at = (layer + y * columns + x) * 2;
          const k = bytes[at]! | (bytes[at + 1]! << 8);
          const region = k === 0 ? undefined : regions[k - 1];
          if (region !== undefined && region.kind === kind) return region;
        }
      }
    }
    return null;
  }
}

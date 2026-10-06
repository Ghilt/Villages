import type * as maplibregl from 'maplibre-gl';
import { decodeOrigin, namesAt, squareAt, whereFrom } from '@villages/world';
import type { OriginFile, OriginGrid, WhereFrom, WorldName } from '@villages/world';

import { note } from '../log/log';
import { worldRootOf } from './masters';

/**
 * Where a point of the master came from on Earth, said in the debug log when the map is clicked under the
 * Origin renderer. The picture says it for the whole world at once; this says it for one place, with the
 * numbers, and with the river, lake or peak named there, carried from Earth by `npm run world:names`, and the
 * region it is in or the sea it is by. The map is worked out by `npm run world:origin` (see
 * `docs/plans/real-world-names.md`), and all of it is read the first time it is asked for, because it is twenty
 * megabytes nobody needs until then.
 */

/** A named region, a sea or a stretch of land, as `names.json` lists them; `regions.bin` numbers them from one. */
interface NamedRegion {
  readonly kind: 'sea' | 'land';
  readonly name: string;
  readonly feature: string;
}

interface Loaded {
  readonly file: OriginFile;
  readonly grid: OriginGrid;
  /** Earth's names carried into this world, or none if `world:names` has not been run for it. */
  readonly names: readonly WorldName[] | null;
  /** For every square, the land it is in and the sea it is by, or none if they were not worked out. */
  readonly regions: {
    readonly list: readonly NamedRegion[];
    readonly land: Uint16Array;
    readonly sea: Uint16Array;
  } | null;
}

const loaded = new Map<string, Promise<Loaded | null>>();

function load(master: string): Promise<Loaded | null> {
  let found = loaded.get(master);
  if (found === undefined) {
    const root = `${worldRootOf(master)}/origin`;
    found = Promise.all([
      fetch(`${root}/origin.json`),
      fetch(`${root}/origin.bin`),
      fetch(`${worldRootOf(master)}/names.json`),
      fetch(`${worldRootOf(master)}/regions.bin`),
    ])
      .then(async ([json, bin, names, regions]) => {
        if (!json.ok || !bin.ok) return null;
        const file = (await json.json()) as OriginFile;
        const carried = names.ok
          ? ((await names.json()) as { names: WorldName[]; regions?: NamedRegion[] })
          : null;
        const squares = file.columns * file.rows;
        const layers =
          regions.ok && carried?.regions !== undefined ? new Uint16Array(await regions.arrayBuffer()) : null;
        return {
          file,
          grid: decodeOrigin(await bin.arrayBuffer(), file),
          names: carried?.names ?? null,
          regions:
            layers === null || layers.length !== squares * 2
              ? null
              : { list: carried!.regions!, land: layers.subarray(0, squares), sea: layers.subarray(squares) },
        };
      })
      .catch(() => null);
    loaded.set(master, found);
  }
  return found;
}

/** Says what the origin map found for a master, then where every clicked point came from, until stopped. */
export function watchOrigin(map: maplibregl.Map, master: string): () => void {
  let origin: Loaded | null = null;
  let stopped = false;
  void load(master).then((answer) => {
    if (stopped) return;
    origin = answer;
    if (answer === null) {
      note('origin', `${master} has no origin map yet: npm run world:origin --prefix frontend -- ${master}`);
      return;
    }
    const { earth, invented, clone } = answer.file.counts;
    const land = Math.max(1, earth + invented + clone);
    const share = (part: number) => `${((100 * part) / land).toFixed(1)}%`;
    note(
      'origin',
      `${master} against ${answer.file.from}: ${share(earth)} of its land from Earth, ${share(invented)} invented, ` +
        `${share(clone)} copies. Click the map to ask where a place came from.`,
    );
    note(
      'origin',
      answer.names === null
        ? `no names carried into ${master} yet: npm run world:names --prefix frontend -- ${master}`
        : `${answer.names.length} of Earth's names carried into ${master}, in English: the towns of 1790, and rivers, lakes and peaks under today's names` +
            (answer.regions === null
              ? ', and no seas or regions'
              : `, and ${answer.regions.list.length} named seas and regions of land`),
    );
  });
  const onClick = (event: maplibregl.MapMouseEvent) => {
    if (origin === null) return;
    const { lng, lat } = event.lngLat;
    const found = whereFrom(origin.grid, lng, lat, origin.file.width, origin.file.height);
    const here = origin.names === null ? '' : named(origin.names, lng, lat);
    const k = squareAt(origin.grid, lng, lat, origin.file.width, origin.file.height);
    const around = origin.regions === null ? '' : regionLine(origin.regions, k, found.kind === 'sea');
    note(
      'origin',
      `${degrees(lat, 'N', 'S')} ${degrees(lng, 'E', 'W')}: ${describe(found, lng, lat)}${around}${here}`,
    );
  };
  map.on('click', onClick);
  return () => {
    stopped = true;
    map.off('click', onClick);
  };
}

export function describe(found: WhereFrom, lng: number, lat: number): string {
  if (found.kind === 'sea') return 'sea';
  const sure = `sure ${found.agreement.toFixed(2)}`;
  if (found.kind === 'invented')
    return `invented land, like nowhere on Earth (best ${found.agreement.toFixed(2)})`;
  const east = ((((found.lng - lng) % 360) + 540) % 360) - 180;
  const moved = Math.hypot(east * Math.cos((lat * Math.PI) / 180), found.lat - lat);
  const where = `${degrees(found.lat, 'N', 'S')} ${degrees(found.lng, 'E', 'W')}`;
  const travel = moved < 0.05 ? 'where it was' : `moved ${moved.toFixed(1)}°`;
  return found.kind === 'clone'
    ? `a copy of Earth at ${where}, which is in the world elsewhere too (${sure})`
    : `from Earth at ${where}, ${travel} (${sure})`;
}

/**
 * The town of 1790 a place is near, the river it is by, the lake it is in or by and the peak it is near, as
 * the end of a line, every one in English with its other name after it: a town's today, a river's own.
 */
export function named(names: readonly WorldName[], lng: number, lat: number): string {
  const { town, river, lake, peak } = namesAt(names, lng, lat);
  const call = (one: WorldName) => (one.also === undefined ? one.name : `${one.name} (${one.also})`);
  const parts = [
    town === undefined ? null : `near ${town.name}${town.also === undefined ? '' : ` (${town.also} today)`}`,
    river === undefined ? null : `by the ${call(river)}`,
    lake === undefined ? null : `at ${call(lake)}`,
    peak === undefined
      ? null
      : `near ${call(peak)}${peak.elevation === undefined ? '' : `, ${peak.elevation.toLocaleString('en-GB')} m`}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? '' : `; ${parts.join(', ')}`;
}

/**
 * The land a square is in and the sea it is by, said after where it came from. Open sea is named by the
 * coast nearest it, which is what the line says, because nothing at sea came from anywhere.
 */
function regionLine(regions: NonNullable<Loaded['regions']>, k: number, atSea: boolean): string {
  const land = regions.list[(regions.land[k] ?? 0) - 1];
  const sea = regions.list[(regions.sea[k] ?? 0) - 1];
  if (atSea) return sea === undefined ? '' : `, ${called(sea)}, named by the nearest coast`;
  const parts = [
    land === undefined ? null : `in ${called(land)}`,
    sea === undefined ? null : `by ${called(sea)}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? '' : `; ${parts.join(', ')}`;
}

/** A region's name as a sentence would say it: the Alps, the Baltic Sea, but Sicily; and what it is, where its name does not say. */
function called(region: NamedRegion): string {
  const name = region.name === region.name.toUpperCase() ? titled(region.name) : region.name;
  const sort = SORTS[region.feature] ?? region.feature.toLowerCase();
  const bare = /island|isl|cape|continent|geoarea/i.test(region.feature) || /^the /i.test(name);
  const says = sort === '' || name.toLowerCase().includes(sort) || region.kind === 'sea' ? '' : ` (${sort})`;
  return `${bare ? '' : 'the '}${name}${says}`;
}

/** Natural Earth's own words for a sort of region, said plainly; nothing where the name is the whole story. */
const SORTS: Readonly<Record<string, string>> = {
  'Range/mtn': 'range',
  'Pen/cape': 'peninsula',
  'Island group': 'islands',
  Geoarea: '',
  Continent: '',
  'Dragons-be-here': '',
};

function titled(name: string): string {
  return name.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
}

function degrees(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

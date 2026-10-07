import type * as maplibregl from 'maplibre-gl';
import { namesAt, squareAt, whereFrom } from '@villages/world';
import type { WhereFrom, WorldName } from '@villages/world';

import { note } from '../log/log';
import { displayName, loadWorldNames } from './worldNames';
import type { NamedRegion, WorldNames } from './worldNames';

/**
 * Where a point of the master came from on Earth, said in the debug log when the map is clicked under the
 * Origin renderer. The picture says it for the whole world at once; this says it for one place, with the
 * numbers, and with the river, lake or peak named there, carried from Earth by `npm run world:names`, and the
 * region it is in or the sea it is by. All of it is read once, by `worldNames.ts`, the first time it is
 * asked for, because it is twenty megabytes nobody needs until then.
 */

/** Says what the origin map found for a master, then where every clicked point came from, until stopped. */
export function watchOrigin(map: maplibregl.Map, master: string): () => void {
  let origin: WorldNames | null = null;
  let stopped = false;
  void loadWorldNames(master).then((answer) => {
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
        : `${answer.names.length} of Earth's names carried into ${master}, in English: the towns of 1790, rivers, lakes and seas under their names of 1790 where the review gives one, and peaks under today's names` +
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
function regionLine(regions: NonNullable<WorldNames['regions']>, k: number, atSea: boolean): string {
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
  const name = displayName(region);
  const sort = SORTS[region.feature] ?? region.feature.toLowerCase();
  const bare = /island|isl|cape|continent|geoarea/i.test(region.feature) || /^the /i.test(name);
  const says = sort === '' || name.toLowerCase().includes(sort) || region.kind === 'sea' ? '' : ` (${sort})`;
  const also = region.also === undefined ? '' : ` (${region.also} today)`;
  return `${bare ? '' : 'the '}${name}${says}${region.form === '1790' ? also : ''}`;
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

function degrees(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

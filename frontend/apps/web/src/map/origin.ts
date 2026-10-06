import type * as maplibregl from 'maplibre-gl';
import { decodeOrigin, namesAt, whereFrom } from '@villages/world';
import type { OriginFile, OriginGrid, WhereFrom, WorldName } from '@villages/world';

import { note } from '../log/log';
import { worldRootOf } from './masters';

/**
 * Where a point of the master came from on Earth, said in the debug log when the map is clicked under the
 * Origin renderer. The picture says it for the whole world at once; this says it for one place, with the
 * numbers, and with the river, lake or peak named there, carried from Earth by `npm run world:names`. The map
 * is worked out by `npm run world:origin` (see `docs/plans/real-world-names.md`), and both are read the first
 * time they are asked for, because they are eighteen megabytes nobody needs until then.
 */

interface Loaded {
  readonly file: OriginFile;
  readonly grid: OriginGrid;
  /** Earth's names carried into this world, or none if `world:names` has not been run for it. */
  readonly names: readonly WorldName[] | null;
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
    ])
      .then(async ([json, bin, names]) => {
        if (!json.ok || !bin.ok) return null;
        const file = (await json.json()) as OriginFile;
        const carried = names.ok ? ((await names.json()) as { names: WorldName[] }).names : null;
        return { file, grid: decodeOrigin(await bin.arrayBuffer(), file), names: carried };
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
        : `${answer.names.length} of Earth's names carried into ${master}: rivers, lakes and peaks, today's names, not yet 1790's`,
    );
  });
  const onClick = (event: maplibregl.MapMouseEvent) => {
    if (origin === null) return;
    const { lng, lat } = event.lngLat;
    const found = whereFrom(origin.grid, lng, lat, origin.file.width, origin.file.height);
    const here = origin.names === null ? '' : named(origin.names, lng, lat);
    note(
      'origin',
      `${degrees(lat, 'N', 'S')} ${degrees(lng, 'E', 'W')}: ${describe(found, lng, lat)}${here}`,
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

/** The river a place is by, the lake it is in or by, and the peak it is near, as the end of a line. */
export function named(names: readonly WorldName[], lng: number, lat: number): string {
  const { river, lake, peak } = namesAt(names, lng, lat);
  const call = (one: WorldName) => (one.english === undefined ? one.name : `${one.name} (${one.english})`);
  const parts = [
    river === undefined ? null : `by the ${call(river)}`,
    lake === undefined ? null : `at ${call(lake)}`,
    peak === undefined
      ? null
      : `near ${call(peak)}${peak.elevation === undefined ? '' : `, ${peak.elevation.toLocaleString('en-GB')} m`}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? '' : `; ${parts.join(', ')}`;
}

function degrees(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

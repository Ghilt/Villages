import type * as maplibregl from 'maplibre-gl';
import { decodeOrigin, whereFrom } from '@villages/world';
import type { OriginFile, OriginGrid, WhereFrom } from '@villages/world';

import { note } from '../log/log';
import { worldRootOf } from './masters';

/**
 * Where a point of the master came from on Earth, said in the debug log when the map is clicked under the
 * Origin renderer. The picture says it for the whole world at once; this says it for one place, with the
 * numbers. The map is worked out by `npm run world:origin` (see `docs/plans/real-world-names.md`) and read
 * the first time it is asked for, because it is fifteen megabytes nobody needs until then.
 */

interface Loaded {
  readonly file: OriginFile;
  readonly grid: OriginGrid;
}

const loaded = new Map<string, Promise<Loaded | null>>();

function load(master: string): Promise<Loaded | null> {
  let found = loaded.get(master);
  if (found === undefined) {
    const root = `${worldRootOf(master)}/origin`;
    found = Promise.all([fetch(`${root}/origin.json`), fetch(`${root}/origin.bin`)])
      .then(async ([json, bin]) => {
        if (!json.ok || !bin.ok) return null;
        const file = (await json.json()) as OriginFile;
        return { file, grid: decodeOrigin(await bin.arrayBuffer(), file) };
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
  });
  const onClick = (event: maplibregl.MapMouseEvent) => {
    if (origin === null) return;
    const { lng, lat } = event.lngLat;
    const found = whereFrom(origin.grid, lng, lat, origin.file.width, origin.file.height);
    note('origin', `${degrees(lat, 'N', 'S')} ${degrees(lng, 'E', 'W')}: ${describe(found, lng, lat)}`);
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

function degrees(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

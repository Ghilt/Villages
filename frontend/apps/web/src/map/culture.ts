import type * as maplibregl from 'maplibre-gl';
import { cultureAt } from '@villages/world';
import type { CultureFile } from '@villages/world';

import { note } from '../log/log';
import { worldRootOf } from './masters';

/** A master's culture map as the page reads it: what `culture.json` says, and a byte a square. */
export interface CultureMap {
  readonly file: CultureFile;
  readonly cultures: Uint8Array;
}

/** What each culture is called in the log and, from step 13, under a structure. */
export const CULTURE_WORDS: Readonly<Record<string, string>> = {
  european: 'European',
  islamic: 'Islamic',
  eastAsian: 'East Asian',
  african: 'African',
};

/** A master's culture map, read from beside its tiles, or null when `world:culture` has not worked it out. */
export async function loadCultureMap(master: string): Promise<CultureMap | null> {
  const root = `${worldRootOf(master)}/culture`;
  try {
    const [file, bytes] = await Promise.all([
      fetch(`${root}/culture.json`, { cache: 'no-store' }).then((answer) =>
        answer.ok ? answer.json() : null,
      ),
      fetch(`${root}/culture.bin`, { cache: 'no-store' }).then((answer) =>
        answer.ok ? answer.arrayBuffer() : null,
      ),
    ]);
    return file === null || bytes === null
      ? null
      : { file: file as CultureFile, cultures: new Uint8Array(bytes) };
  } catch {
    return null;
  }
}

/**
 * Says what share of a master's land is of each culture, then the culture of every point clicked under the Culture
 * renderer, in the log under `culture`, until stopped.
 */
export function watchCulture(map: maplibregl.Map, master: string): () => void {
  let known: CultureMap | null = null;
  let stopped = false;
  void loadCultureMap(master).then((answer) => {
    if (stopped) return;
    known = answer;
    if (answer === null) {
      note(
        'culture',
        `${master} has no culture map yet: npm run world:culture --prefix frontend -- ${master}`,
      );
      return;
    }
    const land = Math.max(
      1,
      Object.values(answer.file.counts).reduce((sum, n) => sum + n, 0),
    );
    const shares = Object.entries(answer.file.counts)
      .map(([culture, n]) => `${CULTURE_WORDS[culture] ?? culture} ${((100 * n) / land).toFixed(1)}%`)
      .join(', ');
    note(
      'culture',
      `${master}: ${shares} of its land. Click the map to ask what culture a place is built in.`,
    );
  });
  const onClick = (event: maplibregl.MapMouseEvent) => {
    if (known === null) return;
    const { lng, lat } = event.lngLat;
    const culture = cultureAt(known.file, known.cultures, lng, lat);
    note(
      'culture',
      `${lat.toFixed(3)}, ${lng.toFixed(3)}: ${culture === null ? 'sea, built in no culture' : `built in the ${CULTURE_WORDS[culture]} way`}`,
    );
  };
  map.on('click', onClick);
  return () => {
    stopped = true;
    map.off('click', onClick);
  };
}

import { ORIGIN_CLONE, ORIGIN_EARTH, ORIGIN_INVENTED } from './originFile.ts';
import type { OriginGrid } from './originFile.ts';
import { CULTURES } from './structures.ts';
import type { Culture } from './structures.ts';

/**
 * A master's culture map: the building tradition every square of its land is drawn in, worked out from its origin
 * map and `world/cultures.json`. Land that came from Earth takes the culture of the anchor nearest where it came
 * from; invented land takes the culture of the nearest land that came from Earth; sea has none. One byte a square of
 * the origin map, the culture's place in `CULTURES`, and `CULTURE_NONE` for sea. Read when a structure is drawn, so
 * a repainted master redraws its structures, as everything derived from the master does. See
 * docs/plans/structures.md.
 */

/** The byte a square of sea has, which no culture is. */
export const CULTURE_NONE = 255;

/** A place on Earth and the culture it stands for. */
export interface CultureAnchor {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly culture: Culture;
}

/** What `culture.json` says beside a master's culture map. */
export interface CultureFile {
  readonly master: string;
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
  /** How many squares of land have each culture. */
  readonly counts: Readonly<Record<Culture, number>>;
}

/** The anchors in `world/cultures.json`, or the refusal naming the first that cannot be read. */
export function parseCultureAnchors(text: string): CultureAnchor[] {
  const file = JSON.parse(text) as { anchors?: unknown };
  if (!Array.isArray(file.anchors) || file.anchors.length === 0) {
    throw new Error('world/cultures.json lists no anchors');
  }
  return file.anchors.map((one: unknown, at: number) => {
    const anchor = one as Partial<CultureAnchor>;
    const good =
      typeof anchor.name === 'string' &&
      typeof anchor.lat === 'number' &&
      Math.abs(anchor.lat) <= 90 &&
      typeof anchor.lon === 'number' &&
      Math.abs(anchor.lon) <= 180 &&
      CULTURES.includes(anchor.culture as Culture);
    if (!good) {
      throw new Error(
        `world/cultures.json: anchor ${at} is not a name, a place and one of ${CULTURES.join(', ')}`,
      );
    }
    return anchor as CultureAnchor;
  });
}

/** The culture of the anchor nearest a place on Earth, by the angle between them on the sphere. */
export function nearestCulture(anchors: readonly CultureAnchor[], lat: number, lon: number): Culture {
  const toRad = Math.PI / 180;
  let best = anchors[0]!;
  let bestCos = -2;
  const sinLat = Math.sin(lat * toRad);
  const cosLat = Math.cos(lat * toRad);
  for (const anchor of anchors) {
    // The cosine of the angle between the two: the larger, the nearer.
    const cos =
      sinLat * Math.sin(anchor.lat * toRad) +
      cosLat * Math.cos(anchor.lat * toRad) * Math.cos((lon - anchor.lon) * toRad);
    if (cos > bestCos) {
      bestCos = cos;
      best = anchor;
    }
  }
  return best.culture;
}

/**
 * The culture of every square of a master `width` by `height`, by its origin map: Earth's land by the nearest anchor
 * to where it came from, invented land by the nearest square that came from Earth, reached a square at a time from
 * every such square at once, and sea none.
 */
export function culturesOf(
  origin: OriginGrid,
  width: number,
  height: number,
  anchors: readonly CultureAnchor[],
): Uint8Array {
  const { columns, rows } = origin;
  const out = new Uint8Array(columns * rows).fill(CULTURE_NONE);
  const queue = new Int32Array(columns * rows);
  let tail = 0;
  for (let k = 0; k < columns * rows; k += 1) {
    const status = origin.status[k];
    if (status !== ORIGIN_EARTH && status !== ORIGIN_CLONE) continue;
    const lon = (((((origin.x[k]! / width) * 360) % 360) + 360) % 360) - 180;
    const lat = 90 - (origin.y[k]! / height) * 180;
    out[k] = CULTURES.indexOf(nearestCulture(anchors, lat, lon));
    queue[tail++] = k;
  }
  // Out from Earth's land into what was invented, one ring of squares at a time, round the world east and west.
  for (let head = 0; head < tail; head += 1) {
    const k = queue[head]!;
    const x = k % columns;
    const y = Math.floor(k / columns);
    const around = [y * columns + ((x + 1) % columns), y * columns + ((x + columns - 1) % columns)];
    if (y > 0) around.push(k - columns);
    if (y < rows - 1) around.push(k + columns);
    for (const next of around) {
      if (origin.status[next] === ORIGIN_INVENTED && out[next] === CULTURE_NONE) {
        out[next] = out[k]!;
        queue[tail++] = next;
      }
    }
  }
  return out;
}

/** The culture at a world longitude and latitude, by a master's culture map, or null at sea or off it. */
export function cultureAt(
  file: Pick<CultureFile, 'cell' | 'columns' | 'rows' | 'width' | 'height'>,
  cultures: Uint8Array,
  lng: number,
  lat: number,
): Culture | null {
  const mx = Math.min(file.width - 1, Math.max(0, ((lng + 180) / 360) * file.width));
  const my = Math.min(file.height - 1, Math.max(0, ((90 - lat) / 180) * file.height));
  const byte = cultures[Math.floor(my / file.cell) * file.columns + Math.floor(mx / file.cell)];
  return byte === undefined || byte === CULTURE_NONE ? null : (CULTURES[byte] ?? null);
}

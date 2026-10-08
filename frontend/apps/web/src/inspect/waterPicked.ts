import type { DiamondGrid } from '@villages/world';

import type { FogField } from '../fog/fogField';
import { masterWidth, pixelsAt, waterGround, worldOf } from './waterGround';
import { cellsAlong, cellsAround, cutShort } from './waterReach';
import type { LngLat } from './waterReach';
import type { WaterSeen } from './waters';

/**
 * What a click on water picked out, which the fence round it and the ripple along it both draw: the master's own
 * pixels, never the diamonds the ground is painted on at whatever turn, so that the selection is the water and not
 * the way it is drawn. A river is all its water along the course the server sent, however its painting breaks; a
 * lake all its water within its shores; a river or a lake that came without a course, one nobody has named, all the
 * water joined to the click; the sea, which has no shores to stop at, the water joined to the click about it.
 * Worked out once for each window and kept, because both ask. See `waterReach.ts` and decision record 0087.
 */
export interface Picked {
  /** The master's pixels, unturned, one world unit each. */
  readonly grid: DiamondGrid;
  readonly cells: ReadonlySet<number>;
  /** How far a ripple may leap a break in the painting, in pixels: over a river's, and nothing elsewhere. */
  readonly leap: number;
  /** Screen pixels to a world unit at the zoom it was picked at. */
  readonly pixels: number;
}

/** How near the course the painted river's pixels are found, and how far from it they are kept, in pixels. */
const SEED = 4;
const KEEP = 10;
/** How far a ripple leaps a break in a river's painting, in pixels. */
const LEAP = 6;
/** For the sea: how far about the click, in screen pixels at the zoom it was clicked at, and the bounds in pixels. */
const REACH_PX = 520;
const LEAST_REACH = 10;
const MOST_REACH = 200;
/** How far off the click the water may be found, in screen pixels, at most this many pixels. */
const NEAR_PX = 48;
const MOST_NEAR = 24;
/**
 * For a river or a lake with no course: how far about the click it is first read, in pixels, and the furthest it is
 * read out to, the reach doubling each time the water runs out to its edge.
 */
const FIRST_SPAN = 128;
const MOST_SPAN = 1024;
/** How far apart the places along a course are that the tiles are read about, in world units. */
const ALONG = 48;

const kept = new WeakMap<WaterSeen, { field: FogField | null | undefined; picked: Promise<Picked> }>();

/** What the water seen picked out, worked out once for it and the fog it was worked out under. */
export function pickedOf(
  seen: WaterSeen,
  zoom: number,
  worldRoot: string,
  field: FogField | null | undefined,
): Promise<Picked> {
  const had = kept.get(seen);
  if (had !== undefined && had.field === field) {
    return had.picked;
  }
  const picked = pick(seen, zoom, worldRoot, field);
  kept.set(seen, { field, picked });
  return picked;
}

async function pick(
  seen: WaterSeen,
  zoom: number,
  worldRoot: string,
  field: FogField | null | undefined,
): Promise<Picked> {
  const width = await masterWidth();
  const grid = { width, turn: 0 };
  const pixels = pixelsAt(zoom, width);
  const { kind } = seen.water;
  const click = { lng: seen.at.lon, lat: seen.at.lat };
  const near = Math.min(MOST_NEAR, Math.max(2, NEAR_PX / pixels));
  const lines = (seen.water.lines ?? []).map((run) => run.map(({ lat, lon }) => ({ lng: lon, lat })));
  const leap = kind === 'river' ? LEAP : 1;

  if (lines.length > 0 && kind !== 'sea') {
    const open = await waterGround(
      kind,
      worldRoot,
      field,
      [click, ...along(lines, width)],
      KEEP + 4,
      kind === 'lake',
    );
    const cells = cellsAlong(lines, grid, open, SEED, kind === 'lake' ? null : KEEP);
    if (cells.size > 0) {
      return { grid, cells, leap, pixels };
    }
  }
  if (kind !== 'sea') {
    for (let span = FIRST_SPAN; ; span *= 2) {
      const open = await waterGround(kind, worldRoot, field, [click], span + near + 2);
      const cells = cellsAround(click, grid, open, span, near);
      if (span >= MOST_SPAN || !cutShort(click, grid, cells, span)) {
        return { grid, cells, leap, pixels };
      }
    }
  }
  const reach = Math.min(MOST_REACH, Math.max(LEAST_REACH, REACH_PX / pixels));
  const open = await waterGround(kind, worldRoot, field, [click], reach + near + 2);
  return { grid, cells: cellsAround(click, grid, open, reach, near), leap: 1, pixels };
}

/** Places along every run of a course, no further apart than `ALONG`, for the tiles to be read about. */
function along(lines: readonly (readonly LngLat[])[], width: number): LngLat[] {
  const places: LngLat[] = [];
  for (const run of lines) {
    for (let at = 0; at < run.length; at += 1) {
      const from = run[at]!;
      const to = run[at + 1];
      places.push(from);
      if (to === undefined) continue;
      const [x0, y0] = worldOf(from, width);
      const [x1, y1] = worldOf(to, width);
      const steps = Math.floor(Math.hypot(x1 - x0, y1 - y0) / ALONG);
      for (let step = 1; step <= steps; step += 1) {
        const share = step / (steps + 1);
        places.push({
          lng: from.lng + (to.lng - from.lng) * share,
          lat: from.lat + (to.lat - from.lat) * share,
        });
      }
    }
  }
  return places;
}

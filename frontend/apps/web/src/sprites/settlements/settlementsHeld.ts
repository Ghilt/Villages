import {
  GROUND_LATTICE,
  SETTLEMENT_SIDES,
  alongU,
  alongV,
  frameOf,
  inSquare,
  settlementSquare,
} from '@villages/world';
import type { SettlementRecord, SettlementType, SettlementsMapFile } from '@villages/world';

/*
 * The settlements the page holds: every record of the `settlements` layer the gateway sent, each once though it comes
 * in every tile its circle touches, named by the master's settlements map; and which of them a point stands in, which
 * is what makes a structure part of a settlement (decision record 0117).
 */

/** A settlement as the page knows it. */
export interface HeldSettlement {
  /** Its number in the map's list, the same for it on every page. */
  readonly index: number;
  /** Its site's id, which seeds its layout. */
  readonly id: string;
  readonly name: string;
  readonly type: SettlementType;
  readonly level: number;
  /** Its middle, a corner of the ground's lattice, in world units, and its radius. */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** The settlements in the records held, each once, named; one the map does not name is left out. */
export function settlementsHeld(
  map: SettlementsMapFile | null,
  tiles: Iterable<readonly SettlementRecord[]>,
): HeldSettlement[] {
  if (map === null) return [];
  const held = new Map<number, HeldSettlement>();
  for (const records of tiles) {
    for (const record of records) {
      if (held.has(record.index)) continue;
      const named = map.settlements[record.index];
      if (named === undefined) continue;
      held.set(record.index, { ...record, id: named.id, name: named.name });
    }
  }
  return [...held.values()].sort((a, b) => a.index - b.index);
}

/**
 * The settlement a point stands in: of those whose radius holds it, the one whose middle is nearest, so a structure is
 * part of one settlement at most even where two circles overlap. Null for a point in none.
 */
export function settlementAt(
  settlements: readonly HeldSettlement[],
  x: number,
  y: number,
): HeldSettlement | null {
  let best: HeldSettlement | null = null;
  let nearest = Infinity;
  for (const one of settlements) {
    const away = Math.hypot(one.x - x, one.y - y);
    if (away <= one.radius && away < nearest) {
      best = one;
      nearest = away;
    }
  }
  return best;
}

/** Every field the same: a settlement grown a level, or moved, is a new one to lay out and draw. */
export function sameSettlement(a: HeldSettlement, b: HeldSettlement): boolean {
  return (
    a.index === b.index &&
    a.id === b.id &&
    a.name === b.name &&
    a.type === b.type &&
    a.level === b.level &&
    a.x === b.x &&
    a.y === b.y &&
    a.radius === b.radius
  );
}

/** The grid a finder keeps the settlements in, in world units: about a village's circle across. */
const FINDER_CELL = 32;
const finders = new WeakMap<readonly HeldSettlement[], (x: number, y: number) => HeldSettlement | null>();

/**
 * `settlementAt` for one list of settlements, answered from a grid of their circles rather than a walk of them all, and
 * made once a list: every structure on the map asks it, and walking every settlement for each of them was the most of
 * the stall when the camera stopped over busy ground (decision record 0118). The same answers as `settlementAt`.
 */
export function settlementFinder(
  settlements: readonly HeldSettlement[],
): (x: number, y: number) => HeldSettlement | null {
  const made = finders.get(settlements);
  if (made !== undefined) return made;
  const grid = new Map<number, HeldSettlement[]>();
  const key = (cx: number, cy: number) => cy * 65536 + cx;
  for (const one of settlements) {
    for (
      let cy = Math.floor((one.y - one.radius) / FINDER_CELL);
      cy <= Math.floor((one.y + one.radius) / FINDER_CELL);
      cy += 1
    ) {
      for (
        let cx = Math.floor((one.x - one.radius) / FINDER_CELL);
        cx <= Math.floor((one.x + one.radius) / FINDER_CELL);
        cx += 1
      ) {
        const here = grid.get(key(cx, cy));
        if (here === undefined) grid.set(key(cx, cy), [one]);
        else here.push(one);
      }
    }
  }
  const find = (x: number, y: number) =>
    settlementAt(grid.get(key(Math.floor(x / FINDER_CELL), Math.floor(y / FINDER_CELL))) ?? [], x, y);
  finders.set(settlements, find);
  return find;
}

const FRAME = frameOf(GROUND_LATTICE);

/**
 * The settlement whose square of ground a point stands on, in world units: what a click on its ground opens. Its square
 * is laid round the corner nearest its middle, as `settlementIn` lays it; where two squares hold the point, the nearer
 * middle's. Null for a point on none.
 */
export function settlementOnItsSquare(
  settlements: readonly HeldSettlement[],
  x: number,
  y: number,
): HeldSettlement | null {
  const u = Math.floor(alongU(FRAME, x, y));
  const v = Math.floor(alongV(FRAME, x, y));
  const on = settlements.filter((one) =>
    inSquare(
      settlementSquare(
        Math.round(alongU(FRAME, one.x, one.y)),
        Math.round(alongV(FRAME, one.x, one.y)),
        SETTLEMENT_SIDES[Math.max(0, Math.min(2, one.level - 1))]!,
      ),
      u,
      v,
    ),
  );
  return on.length === 0
    ? null
    : on.reduce((best, one) =>
        Math.hypot(one.x - x, one.y - y) < Math.hypot(best.x - x, best.y - y) ? one : best,
      );
}

const maps = new Map<string, Promise<SettlementsMapFile | null>>();

/** The master's settlements map, fetched once; null where `world:settlements` has written none. */
export function settlementsMap(tilesRoot: string): Promise<SettlementsMapFile | null> {
  let already = maps.get(tilesRoot);
  if (already === undefined) {
    already = fetch(`${tilesRoot}/sprites/settlements/map.json`, { cache: 'no-store' })
      .then((answer) => (answer.ok ? (answer.json() as Promise<SettlementsMapFile>) : null))
      .catch(() => null);
    maps.set(tilesRoot, already);
  }
  return already;
}

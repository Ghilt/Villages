/*
 * Which places a road joins: the settlements and the ruined towns, by their relative-neighbourhood graph - two places
 * are joined when no third stands nearer both of them than they stand to each other - no longer than the longest
 * road, and never one ruin to another, so every road has somebody living at one end of it. The graph holds every
 * place's join to its nearest, so a settlement with any place within the longest road is never left alone, and it
 * adds no join for a place that would only shorten a trip already made through a third. Pure, and the same in any
 * order. See docs/plans/settlements-and-roads.md and decision record 0115.
 */

/** A place a road may end at: a settlement's site or a ruined town, where it stands in world units. */
export interface RoadPlace {
  readonly id: string;
  readonly kind: 'settlement' | 'ruin';
  readonly x: number;
  readonly y: number;
}

/** Two places a road is to join, by their ids in order, and how far apart they stand. */
export interface Join {
  readonly a: string;
  readonly b: string;
  readonly km: number;
}

/** The grid the places are found by, in world units a side. */
const CELL = 32;

/**
 * Every join of the graph, shortest first: `kmPerUnit` says how many kilometres a world unit is at a distance south,
 * which the world's projection makes smaller towards the poles.
 */
export function placesJoined(
  places: readonly RoadPlace[],
  longestKm: number,
  kmPerUnit: (y: number) => number,
): Join[] {
  const sorted = [...places].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const grid = new Map<number, number[]>();
  const cellOf = (x: number, y: number) => Math.floor(y / CELL) * 65536 + Math.floor(x / CELL);
  sorted.forEach((place, at) => {
    const key = cellOf(place.x, place.y);
    const held = grid.get(key);
    if (held === undefined) grid.set(key, [at]);
    else held.push(at);
  });
  const km = (a: RoadPlace, b: RoadPlace) => Math.hypot(a.x - b.x, a.y - b.y) * kmPerUnit((a.y + b.y) / 2);
  /** Every place within `units` of a point, by its place in `sorted`. */
  const near = (x: number, y: number, units: number): number[] => {
    const out: number[] = [];
    const reach = Math.ceil(units / CELL);
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    for (let gy = cy - reach; gy <= cy + reach; gy += 1) {
      for (let gx = cx - reach; gx <= cx + reach; gx += 1) {
        for (const at of grid.get(gy * 65536 + gx) ?? []) out.push(at);
      }
    }
    return out;
  };

  const joins: Join[] = [];
  sorted.forEach((a, i) => {
    // A little past the longest, for the projection changing between them.
    const units = (longestKm / kmPerUnit(a.y)) * 1.05 + 1;
    for (const j of near(a.x, a.y, units)) {
      if (j <= i) continue;
      const b = sorted[j]!;
      if (a.kind === 'ruin' && b.kind === 'ruin') continue;
      const apart = km(a, b);
      if (apart > longestKm) continue;
      // A third nearer both than they are to each other stands in the lune between them, so within `apart` of a.
      const lune = near(a.x, a.y, (apart / kmPerUnit(a.y)) * 1.01 + 1);
      const between = lune.some((k) => {
        if (k === i || k === j) return false;
        const c = sorted[k]!;
        return km(a, c) < apart && km(b, c) < apart;
      });
      if (!between) joins.push({ a: a.id, b: b.id, km: apart });
    }
  });
  return joins.sort(
    (one, other) =>
      one.km - other.km || (one.a < other.a ? -1 : one.a > other.a ? 1 : 0) || (one.b < other.b ? -1 : 1),
  );
}

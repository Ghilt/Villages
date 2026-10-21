import type { Join, RoadPlace } from './graph.ts';

/*
 * The villages the roads leave alone: a settlement with no other settlement in its network - none at all, or only a
 * ruin - after the graph's joins are routed. Each is offered more joins, to the nearest settlements outside its
 * network out to a far limit, nearest first, so that a road reaches another village wherever the ground allows one.
 * Pure, and the same in any order. See docs/plans/houses-bridges-and-road-render.md and decision record 0115.
 */

/** The networks the places stand in, joined as roads are routed between them. */
export class Networks {
  private readonly parent = new Map<string, string>();
  /** How many settlements each network holds, by its root. */
  private readonly settlements = new Map<string, number>();

  constructor(places: readonly RoadPlace[]) {
    for (const place of places) {
      this.parent.set(place.id, place.id);
      this.settlements.set(place.id, place.kind === 'settlement' ? 1 : 0);
    }
  }

  /** The network a place stands in, named by one of its places. */
  of(id: string): string {
    let root = id;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let at = id;
    while (at !== root) {
      const next = this.parent.get(at)!;
      this.parent.set(at, root);
      at = next;
    }
    return root;
  }

  /** Two places joined by a road: their networks are one. */
  join(a: string, b: string): void {
    const [one, other] = [this.of(a), this.of(b)].sort();
    if (one === other) return;
    this.parent.set(other!, one!);
    this.settlements.set(one!, this.settlements.get(one!)! + this.settlements.get(other!)!);
  }

  /** Whether a settlement's network holds another settlement. */
  joinedToAnother(id: string): boolean {
    return this.settlements.get(this.of(id))! > 1;
  }
}

/**
 * For every settlement alone in its network, the joins it is offered: to the settlements outside its network within
 * `farKm`, nearest first, at most `tries` of them. The lonely ones come nearest-offer first, so short roads are laid
 * before long ones and a long one can share them.
 */
export function lonelyOffers(
  places: readonly RoadPlace[],
  networks: Networks,
  farKm: number,
  tries: number,
  kmPerUnit: (y: number) => number,
): { readonly id: string; readonly offers: readonly Join[] }[] {
  const settlements = places
    .filter((place) => place.kind === 'settlement')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const cell = 64;
  const grid = new Map<number, RoadPlace[]>();
  const cellOf = (x: number, y: number) => Math.floor(y / cell) * 65536 + Math.floor(x / cell);
  for (const place of settlements) {
    const key = cellOf(place.x, place.y);
    const held = grid.get(key);
    if (held === undefined) grid.set(key, [place]);
    else held.push(place);
  }
  const lonely: { id: string; offers: Join[] }[] = [];
  for (const place of settlements) {
    if (networks.joinedToAnother(place.id)) continue;
    const own = networks.of(place.id);
    const units = (farKm / kmPerUnit(place.y)) * 1.05 + 1;
    const reach = Math.ceil(units / cell);
    const cx = Math.floor(place.x / cell);
    const cy = Math.floor(place.y / cell);
    const offers: Join[] = [];
    for (let gy = cy - reach; gy <= cy + reach; gy += 1) {
      for (let gx = cx - reach; gx <= cx + reach; gx += 1) {
        for (const other of grid.get(gy * 65536 + gx) ?? []) {
          if (other.id === place.id || networks.of(other.id) === own) continue;
          const km = Math.hypot(other.x - place.x, other.y - place.y) * kmPerUnit((other.y + place.y) / 2);
          if (km <= farKm) offers.push({ a: place.id, b: other.id, km });
        }
      }
    }
    offers.sort((one, other) => one.km - other.km || (one.b < other.b ? -1 : 1));
    if (offers.length > 0) lonely.push({ id: place.id, offers: offers.slice(0, tries) });
  }
  return lonely.sort((one, other) => one.offers[0]!.km - other.offers[0]!.km || (one.id < other.id ? -1 : 1));
}

import type { JettyAxis } from './settlementLooks.ts';
import { settlementSquare } from './settlements.ts';
import type { SettlementSquare, SettlementType } from './settlements.ts';
import type { Culture } from './structures.ts';

/*
 * A settlement laid out, worked out from its site - its id, its type, its level - the culture under it and the ground,
 * and from nothing else: by the bake, which files its buildings for the opening to raise, each a structure of its own,
 * and by the page, which lays out what is not a structure - its streets, its jetties, its net racks and boats - the
 * same way from the same tiles (decision records 0114 and 0117). Pure, in the lattice's whole numbers, and asking no
 * engine's trigonometry.
 *
 * Its middle is a corner of the ground's lattice. Two streets run through it along the lattice's two axes, a row and
 * a column of diamonds, and the green is where they meet; neither ever holds a building. About them the ground is cut
 * into lots three diamonds a side, ring after ring: a hamlet stands in the ring next to the green, a village reaches a
 * ring further and a large village one more, so its square of ground is seven, thirteen or nineteen diamonds a side.
 * Each lot is kept or left by a roll of its own against its ring's share, and holds at most one building, standing
 * against the street: a house; in a village or larger, a mill on the best lot by a river or a lake; in a large village,
 * a market on the four lots of a quarter nearest the green. So a higher level holds every building of the lower, and
 * more about them. A building is never laid where its base would stand on water. A fishing village's lots by the water
 * hold its houses and net racks, with a jetty from the shore and a boat beside it.
 */

/** What a diamond of ground is to a settlement: land to build on, a river or open water, or not known yet. */
export type DiamondFooting = 'land' | 'river' | 'water' | null;

/** The ground under a diamond of the lattice, by its two whole numbers. */
export type FootingOf = (u: number, v: number) => DiamondFooting;

/** The structures a settlement is built of, each of the catalogue, and the side of its base at its first level. */
export const BUILDING_SIDES = { house: 3, mill: 2, market: 5 } as const;
export type SettlementBuilding = keyof typeof BUILDING_SIDES;

/** One building of a settlement, a structure of its own: its type, the lattice corner of its foot, its side, its rank. */
export interface Building {
  readonly type: SettlementBuilding;
  /** The front corner of its base: the base covers the diamonds `u - side` to `u - 1`, and the same of `v`. */
  readonly u: number;
  readonly v: number;
  readonly side: number;
  /** Its lot's roll, the lower the nearer the core: what thins a settlement drawn at a lower dial. */
  readonly rank: number;
}

/** What stands about a fishing village and is no structure: a net rack or a boat, in its culture, where its foot is. */
export interface Dress {
  readonly piece: 'netRack' | 'boat';
  readonly culture: Culture;
  readonly u: number;
  readonly v: number;
  readonly side: number;
  readonly rank: number;
}

/** A jetty, by the axis it lies along and the middle of its deck, in the lattice's own numbers. */
export interface Jetty {
  readonly axis: JettyAxis;
  readonly u: number;
  readonly v: number;
}

export interface LaidOut {
  readonly square: SettlementSquare;
  readonly buildings: readonly Building[];
  readonly dress: readonly Dress[];
  readonly jetties: readonly Jetty[];
}

/** A lot's side in diamonds, and the share of each ring's lots that holds a building. */
const LOT = 3;
const KEPT = [0.85, 0.6, 0.45] as const;
/** The sides a settlement's square has at each level: its rings of lots and the streets between them. */
export const SETTLEMENT_SIDES = [7, 13, 19] as const;

/** A number for a string, FNV-1a. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(at), 0x01000193);
  }
  return hash >>> 0;
}

/** A roll between nought and one for a lot of one settlement, the same on every page. */
function roll(seed: number, a: number, b: number, salt: number): number {
  let h =
    seed ^
    Math.imul(a + 0x9e37, 0x27d4eb2d) ^
    Math.imul(b + 0x7f4a, 0x165667b1) ^
    Math.imul(salt, 0x1b873593);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** One lot: the first diamond of each axis it covers, which side of each street it lies, and its ring. */
interface Lot {
  readonly fromU: number;
  readonly fromV: number;
  /** Which way from the streets it lies, along each axis: towards them a building stands. */
  readonly su: 1 | -1;
  readonly sv: 1 | -1;
  readonly ring: number;
  /** Its place about the middle, the same whatever the middle, for its rolls. */
  readonly k: number;
  readonly j: number;
}

function lotsOf(u: number, v: number, rings: number): Lot[] {
  const lots: Lot[] = [];
  for (const su of [1, -1] as const) {
    for (const sv of [1, -1] as const) {
      for (let k = 0; k < rings; k += 1) {
        for (let j = 0; j < rings; j += 1) {
          lots.push({
            fromU: su === 1 ? u + 1 + LOT * k : u - LOT * (k + 1),
            fromV: sv === 1 ? v + 1 + LOT * j : v - LOT * (j + 1),
            su,
            sv,
            ring: Math.max(k, j),
            k: su * (k + 1),
            j: sv * (j + 1),
          });
        }
      }
    }
  }
  return lots;
}

/** The base of a building of `side` in a lot, against the streets: the first diamond of each axis it covers. */
function baseIn(lot: Lot, side: number): { fromU: number; fromV: number } {
  return {
    fromU: lot.su === 1 ? lot.fromU : lot.fromU + LOT - side,
    fromV: lot.sv === 1 ? lot.fromV : lot.fromV + LOT - side,
  };
}

/**
 * The settlement whose site is `id`, of a type at a level, its middle the lattice corner `u`, `v`, in a culture: its
 * square, its buildings, its dress and its jetties. `'unknown'` while any of the ground it asks after is not known yet, so it is
 * never laid out on a guess and laid out again differently a moment later.
 */
export function settlementIn(
  id: string,
  type: SettlementType,
  level: number,
  culture: Culture,
  u: number,
  v: number,
  ground: FootingOf,
): LaidOut | 'unknown' {
  const rings = Math.max(1, Math.min(3, Math.round(level)));
  const square = settlementSquare(u, v, SETTLEMENT_SIDES[rings - 1]!);
  const seed = hashOf(id);
  const lots = lotsOf(u, v, rings);
  // Every diamond the lots, and a ring about them, stand on: known before anything is laid out.
  const footing = new Map<string, DiamondFooting>();
  const footOf = (du: number, dv: number): DiamondFooting => {
    const key = `${du}:${dv}`;
    if (!footing.has(key)) footing.set(key, ground(du, dv));
    return footing.get(key)!;
  };
  for (let du = square.fromU - 4; du < square.fromU + square.side + 4; du += 1) {
    for (let dv = square.fromV - 4; dv < square.fromV + square.side + 4; dv += 1) {
      if (footOf(du, dv) === null) return 'unknown';
    }
  }
  const dry = (fromU: number, fromV: number, side: number) => {
    for (let du = fromU; du < fromU + side; du += 1) {
      for (let dv = fromV; dv < fromV + side; dv += 1) {
        if (footOf(du, dv) !== 'land') return false;
      }
    }
    return true;
  };
  const covers = (one: Building, du: number, dv: number) =>
    du >= one.u - one.side && du < one.u && dv >= one.v - one.side && dv < one.v;
  const wetAround = (one: Building) => {
    for (let du = one.u - one.side - 2; du <= one.u + 1; du += 1) {
      for (let dv = one.v - one.side - 2; dv <= one.v + 1; dv += 1) {
        if (footOf(du, dv) === 'water') return true;
      }
    }
    return false;
  };
  const wetBy = (lot: Lot) => {
    for (let du = lot.fromU - 1; du <= lot.fromU + LOT; du += 1) {
      for (let dv = lot.fromV - 1; dv <= lot.fromV + LOT; dv += 1) {
        if (footOf(du, dv) === 'water') return true;
      }
    }
    return false;
  };
  const kept = lots
    .map((lot) => ({ lot, rank: roll(seed, lot.k, lot.j, 1) }))
    .filter(({ lot, rank }) => rank < KEPT[lot.ring]!);
  // A village's mill on the best of its inner lots by a river or a lake, the same at every level from a village up.
  const mill =
    rings >= 2
      ? kept
          .filter(({ lot }) => lot.ring <= 1 && wetBy(lot))
          .sort((one, other) => one.rank - other.rank)
          .find(({ lot }) => {
            const base = baseIn(lot, BUILDING_SIDES.mill);
            return dry(base.fromU, base.fromV, BUILDING_SIDES.mill);
          })
      : undefined;
  // A large village's market on the four lots of a quarter nearest the green, never the mill's, which no house then
  // takes: the one place a higher level does not hold what the lower did.
  const quarterOf = (lot: Lot) => [1, -1].indexOf(lot.su) * 2 + [1, -1].indexOf(lot.sv);
  const first = Math.floor(roll(seed, 0, 0, 3) * 4);
  const quarter =
    rings >= 3
      ? ([0, 1, 2, 3]
          .map((step) => (first + step) % 4)
          .find((one) => mill === undefined || quarterOf(mill.lot) !== one) ?? -1)
      : -1;
  const inQuarter = (lot: Lot) => quarterOf(lot) === quarter && Math.abs(lot.k) <= 2 && Math.abs(lot.j) <= 2;
  const buildings: Building[] = [];
  const dress: Dress[] = [];
  const jetties: Jetty[] = [];
  const market = lots.find((lot) => inQuarter(lot) && Math.abs(lot.k) === 1 && Math.abs(lot.j) === 1);
  if (market !== undefined) {
    // Against both streets, across the inner lot and into the next one out.
    const side = BUILDING_SIDES.market;
    const fromU = market.su === 1 ? market.fromU : market.fromU + LOT - side;
    const fromV = market.sv === 1 ? market.fromV : market.fromV + LOT - side;
    if (dry(fromU, fromV, side)) {
      buildings.push({ type: 'market', u: fromU + side, v: fromV + side, side, rank: 0 });
    }
  }
  for (const { lot, rank } of kept) {
    if (inQuarter(lot) && buildings.some((one) => one.type === 'market')) continue;
    const shore = type === 'fishingVillage' && wetBy(lot);
    const what: SettlementBuilding = mill !== undefined && lot === mill.lot && !shore ? 'mill' : 'house';
    const side = BUILDING_SIDES[what];
    const base = baseIn(lot, side);
    if (!dry(base.fromU, base.fromV, side)) continue;
    buildings.push({ type: what, u: base.fromU + side, v: base.fromV + side, side, rank });
    if (!shore) continue;
    // A net rack in the lot's far corner, where the house leaves room.
    const rack = {
      fromU: lot.su === 1 ? lot.fromU + LOT - 1 : lot.fromU,
      fromV: lot.sv === 1 ? lot.fromV + LOT - 1 : lot.fromV,
    };
    if (dry(rack.fromU, rack.fromV, 1) && !buildings.some((one) => covers(one, rack.fromU, rack.fromV))) {
      dress.push({
        piece: 'netRack',
        culture,
        u: rack.fromU + 1,
        v: rack.fromV + 1,
        side: 1,
        rank: rank + 0.001,
      });
    }
  }
  // Jetties from the shore: the houses by the water nearest the green first, as many as the level, each out along an
  // axis where open water runs three diamonds from the house's edge, with a boat moored at its end.
  const huts =
    type === 'fishingVillage'
      ? buildings.filter((one) => one.type === 'house' && wetAround(one)).sort((a, b) => a.rank - b.rank)
      : [];
  for (const hut of huts) {
    if (jetties.length >= rings) break;
    for (const [axis, du, dv] of [
      ['u', 1, 0],
      ['u', -1, 0],
      ['v', 0, 1],
      ['v', 0, -1],
    ] as const) {
      const startU = du === 0 ? hut.u - 1 : du === 1 ? hut.u : hut.u - hut.side - 1;
      const startV = dv === 0 ? hut.v - 1 : dv === 1 ? hut.v : hut.v - hut.side - 1;
      const reach = [0, 1, 2, 3].map((step) => footOf(startU + du * step, startV + dv * step));
      if (!reach.slice(1).every((footing) => footing === 'water')) continue;
      jetties.push({ axis: axis as JettyAxis, u: startU + du * 2 + 0.5, v: startV + dv * 2 + 0.5 });
      // A boat on open water beside the jetty's far end, on whichever side has room for it.
      const endU = startU + du * 3;
      const endV = startV + dv * 3;
      const beside =
        du === 0
          ? [
              { fromU: endU + 1, fromV: endV - (dv === 1 ? 1 : 0) },
              { fromU: endU - 2, fromV: endV - (dv === 1 ? 1 : 0) },
            ]
          : [
              { fromU: endU - (du === 1 ? 1 : 0), fromV: endV + 1 },
              { fromU: endU - (du === 1 ? 1 : 0), fromV: endV - 2 },
            ];
      const moored = beside.find(({ fromU, fromV }) =>
        [0, 1].every((a) => [0, 1].every((b) => footOf(fromU + a, fromV + b) === 'water')),
      );
      if (moored !== undefined) {
        dress.push({
          piece: 'boat',
          culture,
          u: moored.fromU + 2,
          v: moored.fromV + 2,
          side: 2,
          rank: hut.rank + 0.002,
        });
      }
      break;
    }
  }
  buildings.sort((a, b) => a.rank - b.rank);
  dress.sort((a, b) => a.rank - b.rank);
  return { square, buildings, dress, jetties };
}

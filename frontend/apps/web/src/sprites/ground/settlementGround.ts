import { inSquare, onStreet, streetEnds } from '@villages/world';
import type { LaidOut } from '@villages/world';

import type { MapSprite } from '../SpriteRenderer';
import type { GroundOf } from './paths';
import { WORKED } from './worked';
import type { Worked } from './worked';
import { diamondKey, keptAt, roll, seedOf } from './workedGround';

/*
 * A settlement's ground, worked out from its layout: its whole square worn, trodden grass more than earth, its rim
 * ragged; its two streets and where they leave the square worn as a road; each building's base and a ring of yard about
 * it; and a lane from every building its street does not pass to the nearest street, walked round the other buildings.
 * Nothing worn on water or a river. Seeded by the structure's id and the diamond, so every page that lays it out alike
 * wears it alike, and it keeps to the fog as its structure does, having no other source. To the paths between
 * buildings the whole settlement is one yard (`yardOf`). See docs/plans/settlements-and-roads.md.
 */

/** How far out past its square a settlement's ground frays, in diamonds, and how much of its rim is kept. */
const FRAY = 2;
const RIM_KEPT = 0.8;
/** How much of a building's ring of yard is worn: little, so the grass between the houses and the streets show. */
const YARD_KEPT = 0.2;

/** A settlement's worn ground, and how many lanes it took. */
export interface SettlementGround {
  worked: Map<number, Worked>;
  lanes: number;
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The base of a building, `side` diamonds back from its front corner, by `diamondKey`. */
function baseOf(building: { u: number; v: number; side: number }): number[] {
  const base: number[] = [];
  for (let u = building.u - building.side; u < building.u; u += 1) {
    for (let v = building.v - building.side; v < building.v; v += 1) base.push(diamondKey(u, v));
  }
  return base;
}

/**
 * The lane from a building to the nearest of its settlement's streets: the fewest diamonds from beside its base to a
 * street, over land, round every base in `bases`, inside its square. Empty when its base touches a street, and null
 * when no way round the others reaches one. Every step tried in the same order, so every page walks the same one.
 */
function laneOf(
  building: { u: number; v: number; side: number },
  laid: LaidOut,
  bases: ReadonlySet<number>,
  ground: GroundOf,
): number[] | null {
  const { square } = laid;
  const came = new Map<number, number | null>();
  let edge: { u: number; v: number; key: number }[] = [];
  for (let u = building.u - building.side; u < building.u; u += 1) {
    for (let v = building.v - building.side; v < building.v; v += 1) {
      for (const [du, dv] of STEPS) {
        const at = { u: u + du, v: v + dv };
        const key = diamondKey(at.u, at.v);
        if (bases.has(key) || came.has(key) || !inSquare(square, at.u, at.v)) continue;
        if (onStreet(square, at.u, at.v)) return [];
        if (ground(at.u, at.v) !== 'land') continue;
        came.set(key, null);
        edge.push({ ...at, key });
      }
    }
  }
  while (edge.length > 0) {
    const next: typeof edge = [];
    for (const here of edge) {
      for (const [du, dv] of STEPS) {
        const at = { u: here.u + du, v: here.v + dv };
        const key = diamondKey(at.u, at.v);
        if (came.has(key) || bases.has(key) || !inSquare(square, at.u, at.v)) continue;
        if (onStreet(square, at.u, at.v)) {
          const lane = [here.key];
          for (let back = came.get(here.key); back !== null && back !== undefined; back = came.get(back)) {
            lane.push(back);
          }
          return lane;
        }
        if (ground(at.u, at.v) !== 'land') continue;
        came.set(key, here.key);
        next.push({ ...at, key });
      }
    }
    edge = next;
  }
  return null;
}

/** One settlement's ground, worn into `worked`, the stronger kept where two meet; how many lanes it took. */
export function wearSettlement(
  worked: Map<number, Worked>,
  id: string,
  laid: LaidOut,
  ground: GroundOf,
): number {
  const wear = (u: number, v: number, kind: Worked) => {
    if (ground(u, v) !== 'land') return;
    const key = diamondKey(u, v);
    if (kind > (worked.get(key) ?? 0)) worked.set(key, kind);
  };
  const seed = seedOf(id);
  const { square } = laid;
  const toU = square.fromU + square.side;
  const toV = square.fromV + square.side;
  for (let u = square.fromU - FRAY; u < toU + FRAY; u += 1) {
    for (let v = square.fromV - FRAY; v < toV + FRAY; v += 1) {
      const outU = Math.max(square.fromU - (u + 0.5), 0, u + 0.5 - toU);
      const outV = Math.max(square.fromV - (v + 0.5), 0, v + 0.5 - toV);
      const rim = u === square.fromU || v === square.fromV || u === toU - 1 || v === toV - 1;
      const chance = roll(seed, u, v);
      if (onStreet(square, u, v)) {
        wear(u, v, WORKED.road);
      } else if (outU === 0 && outV === 0) {
        if (!rim || chance < RIM_KEPT) wear(u, v, WORKED.settlement);
      } else if (chance < keptAt(Math.hypot(outU, outV)) * 0.5) {
        wear(u, v, WORKED.settlement);
      }
    }
  }
  for (const end of streetEnds(square)) wear(end.u, end.v, WORKED.road);

  const bases = new Set(laid.buildings.flatMap(baseOf));
  let lanes = 0;
  for (const building of laid.buildings) {
    for (let u = building.u - building.side; u < building.u; u += 1) {
      for (let v = building.v - building.side; v < building.v; v += 1) wear(u, v, WORKED.footprint);
    }
    for (let u = building.u - building.side - 1; u <= building.u; u += 1) {
      for (let v = building.v - building.side - 1; v <= building.v; v += 1) {
        if (!bases.has(diamondKey(u, v)) && roll(seed ^ 0x5bd1e995, u, v) < YARD_KEPT)
          wear(u, v, WORKED.ring);
      }
    }
    const lane = laneOf(building, laid, bases, ground);
    if (lane === null || lane.length === 0) continue;
    lanes += 1;
    for (const key of lane) {
      if ((worked.get(key) ?? 0) < WORKED.path) worked.set(key, WORKED.path);
    }
  }
  return lanes;
}

/**
 * The ground of every settlement among the sprites laid out yet, worn together, and `rememberingSettlementGround` to
 * hand back the very same while their layouts are the same ones, so the scenery is sorted again only when one changes.
 */
export function settlementGround(sprites: readonly MapSprite[], ground: GroundOf): SettlementGround {
  const worked = new Map<number, Worked>();
  let lanes = 0;
  for (const sprite of sprites) {
    const laid = sprite.structure?.laid;
    if (laid !== undefined) lanes += wearSettlement(worked, sprite.id, laid, ground);
  }
  return { worked, lanes };
}

export function rememberingSettlementGround(): (
  sprites: readonly MapSprite[],
  ground: GroundOf,
) => SettlementGround {
  let last: { laid: readonly LaidOut[]; ground: GroundOf; made: SettlementGround } | null = null;
  return (sprites, ground) => {
    const laid = sprites.flatMap((sprite) => sprite.structure?.laid ?? []);
    const same =
      last !== null &&
      last.ground === ground &&
      last.laid.length === laid.length &&
      last.laid.every((one, at) => one === laid[at]);
    if (!same) last = { laid, ground, made: settlementGround(sprites, ground) };
    return last!.made;
  };
}

/**
 * Two worked grounds as one, the stronger kept where they meet: the first itself when the second adds nothing, and the
 * very one handed back last while both are the ones they were.
 */
export function rememberingWornTogether(): (
  first: ReadonlyMap<number, Worked>,
  second: ReadonlyMap<number, Worked>,
) => ReadonlyMap<number, Worked> {
  let last: { first: unknown; second: unknown; both: ReadonlyMap<number, Worked> } | null = null;
  return (first, second) => {
    if (second.size === 0) return first;
    if (last?.first === first && last.second === second) return last.both;
    const both = new Map(first);
    for (const [key, kind] of second) {
      if (kind > (both.get(key) ?? 0)) both.set(key, kind);
    }
    last = { first, second, both };
    return both;
  };
}

import type { AddedTown, Reviewed } from './review1790.ts';
import { MOST_REACH } from './stands.ts';

/*
 * How big every town of 1790 was, and so how much ground its ruins cover: `world/ruins.json`. Every town of 1790 is a
 * ruin at the world's start (Adam's word of 2026-10-17: "all of them, bigger city, more ruins"), and this is the only
 * thing that says how big each one was - Natural Earth's rank is today's. A town is its Wikidata id with about how
 * many people lived in it then; a town not listed had the few people of a hamlet. See docs/plans/ruined-cities.md.
 */

/** How big a town was, from the greatest to the least: the names `tiers` gives the fewest people each takes. */
export const TIERS = ['great', 'large', 'city', 'town', 'small'] as const;
export type Tier = (typeof TIERS)[number];

/** How people become ground: the radius a town's ruins are built over, and the overgrown ring beyond it. */
export interface RuinsSize {
  /** World units of radius for each square root of a thousand people. */
  readonly perRootThousand: number;
  /** The radius no town's ruins are smaller than, and none larger than. */
  readonly least: number;
  readonly most: number;
  /** How much further than the built radius the ruins' overgrowth reaches, as a share of it. */
  readonly ring: number;
  /** How many people a town not listed had. */
  readonly unlisted: number;
}

/** One town the file lists: its people, its name of 1790 to read it by, and why, where something is said. */
export interface RuinedTown {
  readonly people: number;
  readonly name: string;
  readonly why?: string;
}

export interface Ruins {
  readonly tiers: Readonly<Record<Tier, number>>;
  readonly size: RuinsSize;
  readonly towns: ReadonlyMap<string, RuinedTown>;
}

const positive = (value: unknown): value is number => typeof value === 'number' && value > 0;

/** `world/ruins.json`, or the refusal naming the first thing in it that cannot be read. */
export function parseRuins(text: string): Ruins {
  const file = JSON.parse(text) as { tiers?: unknown; size?: unknown; towns?: unknown };
  const tiers = (file.tiers ?? {}) as Partial<Record<Tier, unknown>>;
  for (const [at, tier] of TIERS.entries()) {
    const fewest = tiers[tier];
    if (typeof fewest !== 'number' || fewest < 0) {
      throw new Error(`world/ruins.json: the tier ${tier} wants the fewest people it takes`);
    }
    const larger = TIERS[at - 1];
    if (larger !== undefined && fewest >= (tiers[larger] as number)) {
      throw new Error(`world/ruins.json: the tier ${tier} must take fewer people than ${larger}`);
    }
  }
  const size = (file.size ?? {}) as Partial<RuinsSize>;
  if (
    !positive(size.perRootThousand) ||
    !positive(size.least) ||
    !positive(size.most) ||
    size.least > size.most ||
    typeof size.ring !== 'number' ||
    size.ring < 0 ||
    !positive(size.unlisted)
  ) {
    throw new Error('world/ruins.json: size wants perRootThousand, least up to most, a ring and unlisted');
  }
  if (size.most * (1 + size.ring) > MOST_REACH) {
    throw new Error(
      `world/ruins.json: the largest ruins reach ${size.most * (1 + size.ring)} units, past the ${MOST_REACH} units a stand holds`,
    );
  }
  if (typeof file.towns !== 'object' || file.towns === null) {
    throw new Error('world/ruins.json lists no towns');
  }
  const towns = new Map<string, RuinedTown>();
  for (const [id, row] of Object.entries(file.towns as Record<string, unknown>)) {
    const [people, name, why] = Array.isArray(row) ? (row as unknown[]) : [];
    if (!/^Q\d+$/.test(id) || !positive(people) || !Number.isInteger(people) || typeof name !== 'string') {
      throw new Error(
        `world/ruins.json: ${id} is not a Wikidata id with a whole number of people and a name`,
      );
    }
    towns.set(id, typeof why === 'string' && why !== '' ? { people, name, why } : { people, name });
  }
  return { tiers: tiers as Record<Tier, number>, size: size as RuinsSize, towns };
}

/**
 * What in the file is not as the review of 1790 has it: an id that is no town of 1790 - one the review says was not
 * there, or never reviewed - or a name that is not the one the review gives it then.
 */
export function ruinsProblems(
  ruins: Ruins,
  review: {
    readonly towns: Readonly<Record<string, Reviewed>>;
    readonly added: Readonly<Record<string, AddedTown>>;
  },
): string[] {
  const problems: string[] = [];
  for (const [id, town] of ruins.towns) {
    const then = review.towns[id]?.[0] ?? review.added[id]?.[0];
    if (then === undefined || then === null) {
      problems.push(`${id} ${town.name} is not a town of 1790`);
    } else if (then !== town.name) {
      problems.push(`${id} is ${then} in 1790, not ${town.name}`);
    }
  }
  return problems;
}

/** How many people lived in a town of 1790, by its Wikidata id. */
export function peopleOf(ruins: Ruins, id: string): number {
  return ruins.towns.get(id)?.people ?? ruins.size.unlisted;
}

/** The tier a town of so many people stands in: the greatest whose fewest it reaches. */
export function tierOf(ruins: Ruins, people: number): Tier {
  return TIERS.find((tier) => people >= ruins.tiers[tier]) ?? 'small';
}

/** The radius, in world units, a town of so many people's ruins are built over. */
export function builtOf(ruins: Ruins, people: number): number {
  const { perRootThousand, least, most } = ruins.size;
  return Math.min(most, Math.max(least, perRootThousand * Math.sqrt(people / 1000)));
}

/** How far a town of so many people's ruins reach: the built radius and its overgrown ring. */
export function reachOf(ruins: Ruins, people: number): number {
  return builtOf(ruins, people) * (1 + ruins.size.ring);
}

import type { AddedTown, Reviewed } from './review1790.ts';
import type { Stand } from './stands.ts';
import type { Culture } from './structures.ts';

/*
 * How big every town of 1790 was, and so how much ground its ruins cover: `world/ruins.json`. Every town of 1790 is a
 * ruin at the world's start (Adam's word of 2026-10-17: "all of them, bigger city, more ruins"), and this is the only
 * thing that says how big each one was - Natural Earth's rank is today's. A town is its Wikidata id with about how
 * many people lived in it then; a town not listed had the few people of a hamlet. See docs/plans/ruined-cities.md.
 */

/**
 * The longest reach and the thickest core a stand record holds: a byte of quarters of a unit and a byte of
 * four-hundredths, as `encodeStands` writes them. Kept here rather than beside it, so that the scenery's step of the
 * world is not made again for a number it never reads; `ruins.test.ts` holds them to what a record carries.
 */
export const MOST_REACH = 255 / 4;
export const MOST_THICKNESS = 255 / 400;

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
  /**
   * How built-up the core of the least town's ruins is and of the greatest's, as the share of its lots that hold a
   * piece: a great city stood thicker than a hamlet. Carried in a stand's thickness byte, so never past 0.6375.
   */
  readonly fullness: readonly [number, number];
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
    !positive(size.unlisted) ||
    !Array.isArray(size.fullness) ||
    !positive(size.fullness[0]) ||
    !positive(size.fullness[1]) ||
    size.fullness[0] > size.fullness[1] ||
    size.fullness[1] > MOST_THICKNESS
  ) {
    throw new Error(
      `world/ruins.json: size wants perRootThousand, least up to most, a ring, unlisted, and a fullness up to ${MOST_THICKNESS}`,
    );
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

/** How built-up a town of so many people's core is: from the least town's fullness to the greatest's, by its radius. */
export function fullnessOf(ruins: Ruins, people: number): number {
  const { least, most, fullness } = ruins.size;
  const along = most === least ? 1 : (builtOf(ruins, people) - least) / (most - least);
  return fullness[0] + (fullness[1] - fullness[0]) * along;
}

/**
 * A town as a stand of the `ruins` layer: its middle in world units, how far its ruins reach, the culture they are
 * built in as the favourite byte - its place in `cultures` - how built-up its core is as the thickness, and a seed
 * from its Wikidata id, so that two towns of one size are laid out differently. See decision record 0101.
 */
export function ruinStand(
  ruins: Ruins,
  town: { readonly id: string; readonly x: number; readonly y: number },
  culture: number,
): Stand {
  const people = peopleOf(ruins, town.id);
  return {
    x: town.x,
    y: town.y,
    reach: reachOf(ruins, people),
    dominant: culture,
    thickness: fullnessOf(ruins, people),
    seed: Number(town.id.slice(1)) % 256,
  };
}

/**
 * What `world:ruins` leaves for the page beside a master's tiles, `sprites/ruins/map.json`: how to read a stand of the
 * layer, and no word of where any town is, which only the stands the gateway sends say (decision record 0067).
 */
export interface RuinsMapFile {
  readonly master: string;
  readonly layer: 'ruins';
  readonly at: string;
  readonly world: { readonly side: number; readonly tileUnits: number };
  /** The overgrown ring as a share of the built radius: a stand's built radius is its reach over one and this. */
  readonly ring: number;
  /** The cultures in the order a stand's favourite byte names them. */
  readonly cultures: readonly Culture[];
  readonly stands: number;
  readonly chunks: number;
  readonly bytes: number;
}

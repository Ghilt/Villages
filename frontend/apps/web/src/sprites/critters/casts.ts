/**
 * Who lives where: the cast of each kind of ground, by its name in `world/palette.json`. Each member is a kind of
 * critter, `world/critters.json`, the way it moves, how common it is there against the rest of the cast, and the
 * scenery it comes out of, by the kinds' names in `world/biomes.json`. Ground with no cast has no critters yet; the
 * rest of the casts come with step 14 of docs/plans/living-world.md.
 */

/**
 * How a critter moves: a flock bursting out of cover, a small animal bounding from one piece of cover to another, a
 * fish jumping out of the water, or a bird circling high over open ground.
 */
export type Behaviour = 'flush' | 'hop' | 'leap' | 'soar';

export interface CastMember {
  kind: string;
  behaviour: Behaviour;
  /** How common it is on this ground, against the rest of the cast: a weight, not a chance. */
  weight: number;
  /** The scenery it comes out of; none for a fish or a hawk, which come out of the water or the open sky. */
  from: readonly string[];
}

/** Small birds, out of the trees and the bushes the scenery drew: in the woods, and out of a lone bush or tree in the open. */
const SONGBIRDS: CastMember = {
  kind: 'songbird',
  behaviour: 'flush',
  weight: 1,
  from: [
    'oak',
    'beech',
    'birch',
    'pine',
    'spruce',
    'jungle',
    'acacia',
    'palm',
    'mangrove',
    'scrub',
    'heather',
  ],
};

/** A squirrel, bounding from one tree to the next in the woods and gone behind it. */
const SQUIRRELS: CastMember = {
  kind: 'squirrel',
  behaviour: 'hop',
  weight: 0.5,
  from: ['oak', 'beech', 'birch', 'pine', 'spruce', 'jungle', 'acacia'],
};

/** A hare, out from behind a bush or a tuft of grass on grassland, a few bounds, and gone behind another. */
const HARES: CastMember = {
  kind: 'hare',
  behaviour: 'hop',
  weight: 0.6,
  from: ['grass', 'scrub', 'heather'],
};

/** A fish, jumping out of the water and falling back. */
const FISH: CastMember = { kind: 'fish', behaviour: 'leap', weight: 1, from: [] };

/** A hawk, circling high and slow over open ground: rare, and long in sight. */
const HAWKS: CastMember = { kind: 'hawk', behaviour: 'soar', weight: 0.12, from: [] };

export const CASTS: Readonly<Record<string, readonly CastMember[]>> = {
  lake: [FISH],
  river: [FISH],
  'shallow-sea': [FISH],
  taiga: [SONGBIRDS, SQUIRRELS],
  'taiga-open': [SONGBIRDS, SQUIRRELS],
  'conifer-forest': [SONGBIRDS, SQUIRRELS],
  'broadleaf-forest': [SONGBIRDS, SQUIRRELS],
  'mixed-forest': [SONGBIRDS, SQUIRRELS],
  rainforest: [SONGBIRDS, SQUIRRELS],
  'dry-forest': [SONGBIRDS, SQUIRRELS],
  'swamp-forest': [SONGBIRDS],
  scrub: [SONGBIRDS],
  heath: [SONGBIRDS],
  'farmland-with-woods': [SONGBIRDS],
  meadow: [SONGBIRDS, HARES, HAWKS],
  steppe: [SONGBIRDS, HARES, HAWKS],
  savanna: [SONGBIRDS, HARES, HAWKS],
  'alpine-meadow': [SONGBIRDS, HAWKS],
  farmland: [SONGBIRDS, HAWKS],
  'bare-rock': [HAWKS],
  'desert-sand': [HAWKS],
  'desert-stone': [HAWKS],
};

/** The member of a cast a draw from nought to one picks, by weight, or null for ground with no cast. */
export function memberOf(cast: readonly CastMember[] | undefined, draw: number): CastMember | null {
  if (cast === undefined || cast.length === 0) return null;
  const total = cast.reduce((sum, member) => sum + member.weight, 0);
  let left = draw * total;
  for (const member of cast) {
    left -= member.weight;
    if (left < 0) return member;
  }
  return cast[cast.length - 1]!;
}

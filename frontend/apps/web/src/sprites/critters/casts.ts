/**
 * Who lives where: the cast of each kind of ground, by its name in `world/palette.json`. Each member is a kind of
 * critter, `world/critters.json`, the way it moves, how common it is there against the rest of the cast, and the
 * scenery it comes out of, by the kinds' names in `world/biomes.json`. Ground with no cast has no critters yet; the
 * rest of the casts come with step 14 of docs/plans/living-world.md.
 */

/** How a critter moves: so far, a flock bursting out of cover. Hop, leap and soar come with steps 11 to 13. */
export type Behaviour = 'flush';

export interface CastMember {
  kind: string;
  behaviour: Behaviour;
  /** How common it is on this ground, against the rest of the cast: a weight, not a chance. */
  weight: number;
  /** The scenery it comes out of. */
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

export const CASTS: Readonly<Record<string, readonly CastMember[]>> = {
  taiga: [SONGBIRDS],
  'taiga-open': [SONGBIRDS],
  'conifer-forest': [SONGBIRDS],
  'broadleaf-forest': [SONGBIRDS],
  'mixed-forest': [SONGBIRDS],
  rainforest: [SONGBIRDS],
  'dry-forest': [SONGBIRDS],
  'swamp-forest': [SONGBIRDS],
  scrub: [SONGBIRDS],
  heath: [SONGBIRDS],
  'farmland-with-woods': [SONGBIRDS],
  meadow: [SONGBIRDS],
  steppe: [SONGBIRDS],
  savanna: [SONGBIRDS],
  'alpine-meadow': [SONGBIRDS],
  farmland: [SONGBIRDS],
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

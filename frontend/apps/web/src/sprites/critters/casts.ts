import { CULTURES, RUIN_PIECES, ruinFrameKey } from '@villages/world';
import type { RuinPieceName } from '@villages/world';

/**
 * Who lives where: the cast of each kind of ground, by its name in `world/palette.json`. Each member is a kind of
 * critter, `world/critters.json`, the way it moves, how common it is there against the rest of the cast, and the
 * scenery it comes out of, by the kinds' names in `world/biomes.json`. Ground with no cast has no critters yet; the
 * rest of the casts come with step 14 of docs/plans/living-world.md. The ruined towns of 1790 have a cast of their own,
 * which comes out of the pieces of the ruins wherever they stand, whatever the ground: see `RUINS_CAST`.
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

/** The pieces of the ruins, in every culture, by their names as scenery: `ruin:hall-european` and the rest. */
const ruinsOf = (pieces: readonly RuinPieceName[]): string[] =>
  pieces.flatMap((piece) => CULTURES.map((culture) => ruinFrameKey(piece, culture)));

/** Crows, bursting out of a hall, a tower, an arch, a gate or a wall in a ragged black flock, or flapping to the next. */
const CROWS: CastMember = {
  kind: 'crow',
  behaviour: 'flush',
  weight: 1,
  from: ruinsOf(['hall', 'tower', 'arch', 'gate', 'wall']),
};

/** A rat, out of a heap of rubble or a broken house, scurrying to the next, and gone into it. */
const RATS: CastMember = {
  kind: 'rat',
  behaviour: 'hop',
  weight: 0.8,
  from: ruinsOf(['rubble', 'shell', 'row']),
};

/** A few crows circling together over any piece of the ruins, slow and long in sight. */
const CROWS_ALOFT: CastMember = {
  kind: 'crow-aloft',
  behaviour: 'soar',
  weight: 0.25,
  from: ruinsOf(RUIN_PIECES),
};

/**
 * The ruins' own cast, which comes out of the pieces of the ruined towns of 1790 and of nothing else: crows out of
 * what still stands high, rats out of what has fallen, and crows circling over all of it. A piece of the ruins brings
 * out only these, on whatever ground it stands; nothing else brings them out at all. See docs/plans/ruined-cities.md.
 */
export const RUINS_CAST: readonly CastMember[] = [CROWS, RATS, CROWS_ALOFT];

/** Whether a piece of scenery, by its kind's name, is a piece of the ruins. */
export const isRuin = (kind: string): boolean => kind.startsWith('ruin:');

/**
 * The member a piece of cover brings out that a draw from nought to one picks: out of a piece of the ruins, one of the
 * ruins' cast that comes out of that piece, by weight; out of anything else, one of the cast of the ground it stands on,
 * by weight, or null for ground with no cast or none known yet.
 */
export function memberFrom(cover: string, land: string | null, draw: number): CastMember | null {
  if (isRuin(cover))
    return memberOf(
      RUINS_CAST.filter((member) => member.from.includes(cover)),
      draw,
    );
  return memberOf(land === null ? undefined : CASTS[land], draw);
}

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

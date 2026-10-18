import { CULTURES, RUIN_PIECES, ruinFrameKey } from '@villages/world';
import type { RuinPieceName } from '@villages/world';

/**
 * Who lives where: the cast of each kind of ground, by its name in `world/palette.json`. Each member is a kind of
 * critter, `world/critters.json`, the way it moves, how common it is there against the rest of the cast, and the
 * scenery it comes out of, by the kinds' names in `world/biomes.json`, or none for a critter that comes out of the open
 * ground or the water at a place of its cell. Ground with no cast has no critters yet; the rest of the casts come with
 * step 14 of docs/plans/living-world.md. The ruined towns of 1790 have a cast of their own,
 * which comes out of the pieces of the ruins wherever they stand, whatever the ground: see `RUINS_CAST`.
 */

/**
 * How a critter moves: a flock bursting out of cover, a small animal bounding from one piece of cover to another, a
 * fish jumping out of the water, a bird circling high over open ground, or a snake gliding through the reeds.
 */
export type Behaviour = 'flush' | 'hop' | 'leap' | 'soar' | 'slither';

export interface CastMember {
  kind: string;
  behaviour: Behaviour;
  /** How common it is on this ground, against the rest of the cast: a weight, not a chance. */
  weight: number;
  /**
   * The scenery it comes out of; none for one that comes out of the open ground, the water or the open sky: a fish, a
   * hawk, a covey of partridges off a field.
   */
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

/**
 * A frog, out of the reeds or the grass of the wet land, hopping to the next tuft; and by any water, a lake's or a
 * river's, out of whatever of these stands beside it, on any ground, hopping into it: see `memberFrom`.
 */
export const FROGS: CastMember = {
  kind: 'frog',
  behaviour: 'hop',
  weight: 1,
  from: ['reed', 'grass', 'fern', 'heather'],
};

/** A snake, gliding out of the reeds or the grass of the wet land into another tuft near by: rarer than the frogs. */
const SNAKES: CastMember = {
  kind: 'snake',
  behaviour: 'slither',
  weight: 0.35,
  from: ['reed', 'grass', 'heather', 'fern', 'mangrove'],
};

/** A covey of partridges, bursting up together out of the open field, low and fast, and down again further off. */
const PARTRIDGES: CastMember = { kind: 'partridge', behaviour: 'flush', weight: 1, from: [] };

/** A lark or two rising out of the open grass, high, and coming down again not far from where they rose. */
const LARKS: CastMember = { kind: 'lark', behaviour: 'flush', weight: 0.5, from: [] };

/** A few grouse bursting out of the heather, low and whirring. */
const GROUSE: CastMember = { kind: 'grouse', behaviour: 'flush', weight: 0.6, from: ['heather'] };

/** Ducks lifting off the wet land's open water and mud between the reeds, climbing away. */
const DUCKS: CastMember = { kind: 'duck', behaviour: 'flush', weight: 0.7, from: [] };

/** Ptarmigan, white on the white, bursting up off the open ice and the polar desert, where nothing stands. */
const PTARMIGAN: CastMember = { kind: 'ptarmigan', behaviour: 'flush', weight: 1, from: [] };

/** Ptarmigan bursting out of the tundra's heather and scrub. */
const TUNDRA_PTARMIGAN: CastMember = { ...PTARMIGAN, from: ['heather', 'scrub'] };

/** Gulls wheeling low and quick over the shallow sea, two to four together. */
const GULLS: CastMember = { kind: 'gull', behaviour: 'soar', weight: 0.35, from: [] };

/** Dolphins of the shallow sea, leaping one after another in a row along the same way. */
const DOLPHINS: CastMember = { kind: 'dolphin', behaviour: 'leap', weight: 0.25, from: [] };

/**
 * A whale far out on the ocean, blowing now and then: its back and a spout of spray standing up out of the sea and
 * falling back. Rare, because the ocean's cast weighs so much less than one: see `openOf`.
 */
const WHALES: CastMember = { kind: 'whale', behaviour: 'leap', weight: 0.15, from: [] };

/** The waters a frog hops into, whatever the ground beside them. */
export const WATERS: readonly string[] = ['lake', 'river'];

export const CASTS: Readonly<Record<string, readonly CastMember[]>> = {
  lake: [FISH],
  river: [FISH],
  ocean: [WHALES],
  'shallow-sea': [FISH, DOLPHINS, GULLS],
  ice: [PTARMIGAN],
  'polar-desert': [PTARMIGAN],
  tundra: [TUNDRA_PTARMIGAN],
  taiga: [SONGBIRDS, SQUIRRELS],
  'taiga-open': [SONGBIRDS, SQUIRRELS],
  'conifer-forest': [SONGBIRDS, SQUIRRELS],
  'broadleaf-forest': [SONGBIRDS, SQUIRRELS],
  'mixed-forest': [SONGBIRDS, SQUIRRELS],
  rainforest: [SONGBIRDS, SQUIRRELS],
  'dry-forest': [SONGBIRDS, SQUIRRELS],
  'swamp-forest': [SONGBIRDS, FROGS, SNAKES, DUCKS],
  mangrove: [SONGBIRDS, SNAKES, DUCKS],
  marsh: [FROGS, SNAKES, DUCKS],
  bog: [SONGBIRDS, FROGS, SNAKES, DUCKS],
  floodplain: [HARES, FROGS, SNAKES, DUCKS],
  paddy: [FROGS, SNAKES, DUCKS],
  scrub: [SONGBIRDS, GROUSE],
  heath: [SONGBIRDS, GROUSE],
  'farmland-with-woods': [SONGBIRDS, PARTRIDGES],
  meadow: [SONGBIRDS, HARES, HAWKS, LARKS],
  steppe: [SONGBIRDS, HARES, HAWKS, LARKS],
  savanna: [SONGBIRDS, HARES, HAWKS, LARKS],
  'alpine-meadow': [SONGBIRDS, HAWKS],
  farmland: [SONGBIRDS, HAWKS, PARTRIDGES, LARKS],
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
 * ruins' cast that comes out of that piece, by weight; out of anything else, one of the cast of the ground it stands on
 * that comes out of cover, by weight, or null for ground with no such cast or none known yet. Beside the water,
 * `byWater`, a frog may come out of any cover it lives in too, whatever the ground's own cast.
 */
export function memberFrom(
  cover: string,
  land: string | null,
  draw: number,
  byWater = false,
): CastMember | null {
  if (isRuin(cover))
    return memberOf(
      RUINS_CAST.filter((member) => member.from.includes(cover)),
      draw,
    );
  if (land === null) return null;
  const cast = CASTS[land]?.filter((member) => member.from.length > 0);
  if (byWater && FROGS.from.includes(cover) && !cast?.includes(FROGS)) {
    return memberOf([...(cast ?? []), FROGS], draw);
  }
  return memberOf(cast, draw);
}

/**
 * The members of a ground's cast that come out of the open ground or the water rather than out of cover, and the share
 * of the cast's weight they are: how often a cell's slot there brings one of them rather than one out of cover. Of
 * one, where the whole cast weighs less than that, so a ground with a light cast is that much quieter: the ocean's
 * whales, now and then, and a hawk over the bare rock as rarely as over the meadow.
 */
export function openOf(land: string | null): { members: readonly CastMember[]; share: number } {
  const cast = land === null ? undefined : CASTS[land];
  const members = cast?.filter((member) => member.from.length === 0) ?? [];
  const weight = (some: readonly CastMember[]) => some.reduce((sum, member) => sum + member.weight, 0);
  return { members, share: members.length === 0 ? 0 : weight(members) / Math.max(1, weight(cast!)) };
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

import type { Cover, Ground } from '../critters/types';

/**
 * What a die throws up where it strikes the ground, by what the ground is: a splash on water, leaves in a wood, sand on
 * sand, grit on rock, snow on ice and snow, and dust anywhere else. Read from the terrain class there and the scenery
 * standing round it, as the critters read them. Adam's word of 2026-10-24.
 */
export type Splash = 'dust' | 'sand' | 'grit' | 'snow' | 'water' | 'leaves';

export const SPLASHES: readonly Splash[] = ['dust', 'sand', 'grit', 'snow', 'water', 'leaves'];

const WATER = new Set(['ocean', 'shallow-sea', 'lake', 'river', 'marsh', 'bog', 'paddy']);
const WOODS = new Set([
  'taiga',
  'taiga-open',
  'conifer-forest',
  'broadleaf-forest',
  'mixed-forest',
  'rainforest',
  'dry-forest',
  'mangrove',
  'swamp-forest',
]);
const SAND = new Set(['desert-sand', 'salt-flat']);
const GRIT = new Set(['desert-stone', 'bare-rock']);
const SNOW = new Set(['ice', 'polar-desert', 'tundra']);

/** How near a tree or a bush must stand to where the die strikes, in world units, for it to shed leaves there. */
const UNDER_LEAVES = 1.5;

/** What a die throws up on ground of the class `terrain`, with `cover` standing round where it strikes. */
export function splashOf(terrain: string | null, cover: readonly Cover[]): Splash {
  if (terrain !== null && WATER.has(terrain)) return 'water';
  if ((terrain !== null && WOODS.has(terrain)) || cover.some((one) => !one.kind.startsWith('ruin')))
    return 'leaves';
  if (terrain === null) return 'dust';
  if (SAND.has(terrain)) return 'sand';
  if (GRIT.has(terrain)) return 'grit';
  if (SNOW.has(terrain)) return 'snow';
  return 'dust';
}

/** What a die throws up at a place of the world, in world units, as `ground` has it: dust while it does not know. */
export function splashAt(ground: Ground, x: number, y: number): Splash {
  const cover = ground.coverIn(x - UNDER_LEAVES, y - UNDER_LEAVES, x + UNDER_LEAVES, y + UNDER_LEAVES) ?? [];
  return splashOf(ground.classAt(x, y), cover);
}

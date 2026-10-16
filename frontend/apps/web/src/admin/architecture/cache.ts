/**
 * The world cache's box on the diagram: the master's tools and the files they make, which `world:ready` borrows
 * for a tree from the shelf every tree shares, and makes once when nobody has. The list is the world steps',
 * `frontend/packages/world/bin/lib/worldSteps.ts`, which `world.test.ts` holds this to. See decision record 0095.
 */
export const WORLD_CACHE = {
  id: 'world-cache',
  name: 'The world cache, shared by every tree',
  where: 'E:\\Code\\Villages\\.git\\world-cache\\',
  what:
    'Each world step inside is made once on the machine, and every tree with the same inputs borrows it. A step is ' +
    "filed under a fingerprint of what it was made from - the master, every file it reads, the tool's own code - " +
    'and borrowed as hard links: seconds where the tool takes minutes. world:ready fills it and lends it, for the ' +
    "quick start and the Debug map's buttons alike; a tool here runs only when nobody has made its step from these " +
    'inputs.',
  tools: [
    'world:import',
    'world:tile',
    'world:paint',
    'world:flow',
    'world:sprites',
    'world:ground',
    'world:origin',
    'world:names',
    'world:culture',
    'world:height',
  ],
  files: [
    'outlines',
    'preview',
    'tiles',
    'paint',
    'flow',
    'sprite-map',
    'stands',
    'ground',
    'origin',
    'names',
    'names-server',
    'culture',
    'height',
  ],
} as const;

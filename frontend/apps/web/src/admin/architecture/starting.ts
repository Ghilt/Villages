/**
 * How a tree starts: what `debug-quick-start.ps1` does, in order, and how long each part took in a brand-new
 * worktree whose world was on the world cache's shelf - no packages, no world, no compiled server - measured on
 * 2026-10-12, beside what the fresh trees of 2026-10-08 to 12 took before the world cache (decision record 0095).
 * `world.test.ts` holds each part to the words the script says as it does it.
 */
export interface Stage {
  name: string;
  /** Words the quick start has where it does this part, so the strip and the script cannot part. */
  says: string;
  /** Seconds after the start it began, and how long it took. */
  from: number;
  seconds: number;
  /** How long it took a fresh tree before the world cache. */
  was: number;
  /** How long it takes the one tree that makes it, when nobody has: once for every tree. */
  made?: number;
  /** Done beside the rest rather than before it. */
  beside?: true;
  what: string;
}

export const STAGES: readonly Stage[] = [
  {
    name: 'tools and the stack',
    says: "Head 'tools'",
    from: 0,
    seconds: 24,
    was: 24,
    what: 'Its ports, node and java, and whether MongoDB and RabbitMQ are up in Docker.',
  },
  {
    name: 'game server',
    says: ':app:bootRun',
    from: 24,
    seconds: 10,
    was: 100,
    beside: true,
    what: 'Started first and waited for last; every class from the build cache another tree filled.',
  },
  {
    name: 'packages',
    says: 'installing dependencies',
    from: 24,
    seconds: 9,
    was: 10,
    what: 'npm install, from npm’s own cache.',
  },
  {
    name: 'world',
    says: 'world:ready',
    from: 33,
    seconds: 14,
    was: 900,
    made: 585,
    what: 'Ten world steps and the downloads borrowed by hard link. Before, every step made again, and ETOPO fetched.',
  },
  {
    name: 'pictures',
    says: 'world:art',
    from: 47,
    seconds: 13,
    was: 13,
    what: 'The sprites and the interface pictures cut, from caches a fresh tree has empty.',
  },
  {
    name: 'dev server',
    says: "@('run', 'dev')",
    from: 62,
    seconds: 6,
    was: 3,
    what: 'Vite, and the address to open.',
  },
];

/** The whole of it, then and now. */
export const FRESH_TREE = { seconds: 68, was: 17 * 60, measured: '2026-10-12' } as const;

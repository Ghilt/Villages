import type { BiomeFile } from '@villages/world';

/**
 * A small sprite map to test the rules with.
 *
 * The rules live in `apps/web` and the data lives in `world/biomes.json`, and the two are checked in
 * different places on purpose: this tsconfig has no node types, deliberately, so nothing here can read
 * the repository. What the real file has to be is `packages/world/src/biome.test.ts`'s business - that
 * it is valid, that it stays inside experiment 0006's budget, and that no kind in it is too short for
 * the camera to ever show whole. What happens to a kind once it has a height and a weight is here.
 */
export const KINDS: BiomeFile['kinds'] = [
  // heather and fernish differ in one thing only, `gather`, so a test can attribute a difference to it.
  { name: 'spruce', groundHeight: 3.4, vary: 0.22, order: 9, gather: 0.96, apart: 0.9, underCanopy: false },
  { name: 'birch', groundHeight: 2.6, vary: 0.3, order: 6, gather: 0.88, apart: 0.7, underCanopy: false },
  { name: 'heather', groundHeight: 1.4, vary: 0.3, order: 1, gather: 0.4, apart: 0.3, underCanopy: true },
  { name: 'fernish', groundHeight: 1.4, vary: 0.3, order: 1, gather: 0.95, apart: 0.3, underCanopy: true },
];

/** Two biomes: one that grows the four kinds on taiga, and the catch-all that grows nothing anywhere. */
export const BIOMES: BiomeFile = {
  ceiling: 0.44,
  most: 0.28,
  region: {
    coarse: { cellsX: 72, cellsY: 36, seed: 1 },
    fine: { cellsX: 216, cellsY: 108, seed: 2 },
    fineWeight: 0.35,
  },
  boundary: { wander: 7, scale: 26, seed: 9931 },
  kinds: KINDS,
  biomes: [
    {
      name: 'wood',
      colour: '#27492f',
      where: {},
      stands: { per1000: 6, reach: [3, 9], inside: 0.245, outside: 0.02 },
      grows: { taiga: { spruce: 10, birch: 4, heather: 3, fernish: 3 } },
    },
    {
      name: 'none',
      colour: '#1d232b',
      where: {},
      stands: { per1000: 0, reach: [1, 1], inside: 0, outside: 0 },
      grows: {},
    },
  ],
};

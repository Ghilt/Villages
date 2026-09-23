import type { BiomeFile } from './biome.ts';

/**
 * A small worked example of a biome file, for the tests of the rules that read one.
 *
 * Deliberately not `world/biomes.json`. What the real file has to be is `biome.test.ts`'s business -
 * that it is valid, that it stays inside experiment 0006's budget, and that no kind in it is too short
 * for the camera to ever show whole. What happens to a kind once it has a height and a weight is tested
 * against this instead, because a rule proved against four kinds is a rule, and one proved against
 * sixteen hand-tuned ones is a coincidence waiting to be retuned.
 *
 * It is exported from the package because two projects test against it now: the scatter, which is here,
 * and the browser's rules about when a kind is worth drawing, which need a camera and so are not.
 */
export const EXAMPLE_KINDS: BiomeFile['kinds'] = [
  // heather and fernish differ in one thing only, `gather`, so a test can attribute a difference to it.
  { name: 'spruce', groundHeight: 3.4, vary: 0.22, order: 9, gather: 0.96, apart: 0.9, underCanopy: false },
  { name: 'birch', groundHeight: 2.6, vary: 0.3, order: 6, gather: 0.88, apart: 0.7, underCanopy: false },
  { name: 'heather', groundHeight: 1.4, vary: 0.3, order: 1, gather: 0.4, apart: 0.3, underCanopy: true },
  { name: 'fernish', groundHeight: 1.4, vary: 0.3, order: 1, gather: 0.95, apart: 0.3, underCanopy: true },
];

/** Two biomes: one that grows the four kinds on taiga, and the catch-all that grows nothing anywhere. */
export const EXAMPLE_BIOMES: BiomeFile = {
  ceiling: 0.44,
  most: 0.28,
  region: {
    coarse: { cellsX: 72, cellsY: 36, seed: 1 },
    fine: { cellsX: 216, cellsY: 108, seed: 2 },
    fineWeight: 0.35,
  },
  sway: { amount: 6, cellsX: 48, cellsY: 24, seed: 7717 },
  boundary: { wander: 7, scale: 26, seed: 9931 },
  kinds: EXAMPLE_KINDS,
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

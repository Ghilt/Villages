import { createTuning } from './tuning';

/**
 * How the grass grows in patches, as numbers Adam moves with the sliders in the Grass fold of the Land part of the
 * debug panel's Shaders section, remembered and said as `tuning.ts` says.
 *
 * Two slow patterns over the ground mark out the patches: where the first is high the ground is bare, where the
 * second is high the grass stands tall, and where it is low it is brush. Each tuft then draws its kind by chance,
 * with odds that change gradually across a patch's edge, so the kinds thin into each other there, and a few of
 * each are scattered everywhere.
 */
export interface GrassTuning {
  /** How big the patches are, in world units. */
  size: number;
  /** How much a finer pattern breaks up the patches' round outlines, nought to one. */
  ragged: number;
  /** How gradually one kind gives way to the next across a patch's edge. */
  soft: number;
  /** The share of tall tufts and of brush that grow anywhere, outside their own patches too. */
  mingle: number;
  /** How much of the grassland is bare, tall and brush, nought to one each. */
  bare: number;
  tall: number;
  brush: number;
  /** How many times taller a tall tuft stands. */
  tallHeight: number;
  /** How big a clump of brush is across, in world units. */
  brushSize: number;
  /** How many of the tufts there could be grow at all, nought to one. */
  density: number;
  /** How many animal trails run through the grass, as so many times its own; none at nought. */
  trails: number;
}

export const GRASS_DEFAULTS: GrassTuning = {
  size: 7,
  ragged: 0.35,
  soft: 0.12,
  mingle: 0.12,
  bare: 0.3,
  tall: 0.35,
  brush: 0.35,
  tallHeight: 1.9,
  brushSize: 0.17,
  density: 1,
  trails: 1,
};

const grass = createTuning('villages.grass.tuning', GRASS_DEFAULTS, 'grass');

export const grassTuningStore = grass.store;
export const setGrassTuning = grass.set;
export const resetGrassTuning = grass.reset;

import { createTuning } from './tuning';

/**
 * How the heath, the scrub and the tundra grow, as numbers Adam moves with the sliders in their fold of the Land part
 * of the debug panel's Shaders section, remembered and said as `tuning.ts` says. Each kind's own sizes and colours
 * are in `look.ts`; these scale all three alike.
 */
export interface HeathTuning {
  /** How big the clumps are, as so many times each kind's own. */
  size: number;
  /** How thickly they grow, as a share of each kind's own. */
  density: number;
  /** The share of the tundra that grows cotton grass rather than a low clump. */
  cotton: number;
  /** How much a gust stirs them, as so many times their own. */
  stir: number;
  /** How many animal trails run through them, as so many times their own; none at nought. */
  trails: number;
}

export const HEATH_DEFAULTS: HeathTuning = {
  size: 1,
  density: 1,
  cotton: 0.08,
  stir: 1,
  trails: 1,
};

const heath = createTuning('villages.heath.tuning', HEATH_DEFAULTS, 'heath');

export const heathTuningStore = heath.store;
export const setHeathTuning = heath.set;
export const resetHeathTuning = heath.reset;

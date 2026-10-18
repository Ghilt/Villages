import { createTuning } from './tuning';

/**
 * How the wet land looks, as numbers Adam moves with the sliders in its fold of the Land part of the debug panel's
 * Shaders section, remembered and said as `tuning.ts` says. Each kind's own water, stems and mist are in `look.ts`;
 * these scale all of them alike.
 */
export interface WetTuning {
  /** How much mist lies over the marsh and the bog, nought to one. */
  mist: number;
  /** How much of the wet land is open water, as so many times each kind's own. */
  pools: number;
  /** The share of a pool's cells a ring spreads in, each few seconds. */
  rings: number;
  /** How tall the reeds and the shoots stand, as so many times each kind's own. */
  stems: number;
}

export const WET_DEFAULTS: WetTuning = {
  mist: 0.5,
  pools: 1,
  rings: 0.3,
  stems: 1,
};

const wet = createTuning('villages.wet.tuning', WET_DEFAULTS, 'wet');

export const wetTuningStore = wet.store;
export const setWetTuning = wet.set;
export const resetWetTuning = wet.reset;

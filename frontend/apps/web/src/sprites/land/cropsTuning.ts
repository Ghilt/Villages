import { createTuning } from './tuning';

/**
 * How the crops stand on the farmland, as numbers Adam moves with the sliders in the Crops fold of the Land part of
 * the debug panel's Shaders section, remembered and said as `tuning.ts` says.
 *
 * The farmland is cut into fields, a patchwork of a few world units each with a bare track between them; each field
 * lies fallow or stands ripe or green, in rows running a way of its own, and long waves roll through it down the wind.
 */
export interface CropsTuning {
  /** How big a field is across, in world units. */
  fieldSize: number;
  /** The share of the fields that lie fallow, nothing standing in them. */
  fallow: number;
  /** How far apart the rows are, in world units. */
  rows: number;
  /** How tall the crops stand, in world units. */
  height: number;
  /** How long a wave is down the wind, in world units, and how strongly its paler side shows, nought to one. */
  waveSize: number;
  waves: number;
}

export const CROPS_DEFAULTS: CropsTuning = {
  fieldSize: 3.5,
  fallow: 0.15,
  rows: 0.4,
  height: 0.3,
  waveSize: 16,
  waves: 0.3,
};

const crops = createTuning('villages.crops.tuning', CROPS_DEFAULTS, 'crops');

export const cropsTuningStore = crops.store;
export const setCropsTuning = crops.set;
export const resetCropsTuning = crops.reset;

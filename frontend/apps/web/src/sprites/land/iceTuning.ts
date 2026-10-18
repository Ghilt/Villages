import { createTuning } from './tuning';

/**
 * How the ice, the salt and the sand look, as numbers Adam moves with the sliders in their fold of the Land part of
 * the debug panel's Shaders section, remembered and said as `tuning.ts` says. Each kind's own glints and drift are in
 * `iceLook.ts`; these scale all of them alike.
 */
export interface IceTuning {
  /** How many glints flash on the ice and the salt, as so many times each kind's own. */
  glints: number;
  /** How strongly the snow streams over the ice and the polar desert, as so many times its own. */
  snow: number;
  /** How strongly the sand blows off the dunes' crests, as so many times its own. */
  sand: number;
}

export const ICE_DEFAULTS: IceTuning = {
  glints: 1,
  snow: 1,
  sand: 1,
};

const ice = createTuning('villages.ice.tuning', ICE_DEFAULTS, 'ice');

export const iceTuningStore = ice.store;
export const setIceTuning = ice.set;
export const resetIceTuning = ice.reset;

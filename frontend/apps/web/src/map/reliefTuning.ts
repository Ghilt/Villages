import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../log/log';

import type { ReliefCurve } from './reliefCurve';

/**
 * The relief's numbers on sliders in the Relief part of the Shaders section, for Adam's eye: how strongly it is
 * drawn at each zoom, for both shaders, and for ours how steep the ground is shaded as and in how many tones.
 * Remembered in the browser that moved them, and said in the log once a slider stops, which is the line to hand
 * over when a setting should become the default, as the rivers' are.
 */
export interface ReliefTuning extends ReliefCurve {
  /** Ours: how many times steeper than it is the ground is shaded as, one being as it is. */
  steepness: number;
  /** Ours: how many hard tones each side of flat, or nought for the shade as it comes. */
  tones: number;
}

/**
 * Stronger on the continent, light close in: Adam's, of 2026-10-07, and then not so taxing, the same evening: a
 * quarter less shade far out, a little less close in, and the ground shaded as a fifth less steep, so the ranges
 * read without the whole continent going to hard light and dark. None of it changes what the relief costs.
 */
export const RELIEF_DEFAULTS: ReliefTuning = {
  far: 0.75,
  near: 0.15,
  from: 6,
  to: 9,
  steepness: 0.8,
  tones: 0,
};

const KEPT = 'villages.relief';

function remembered(): ReliefTuning {
  try {
    const kept = localStorage.getItem(KEPT);
    if (kept === null) {
      return RELIEF_DEFAULTS;
    }
    // Only the numbers there are now: one remembered from an older set of sliders is dropped.
    const parsed = JSON.parse(kept) as Record<string, unknown>;
    const known = Object.fromEntries(
      Object.keys(RELIEF_DEFAULTS)
        .filter((key) => typeof parsed[key] === 'number')
        .map((key) => [key, parsed[key]]),
    );
    return { ...RELIEF_DEFAULTS, ...known };
  } catch {
    return RELIEF_DEFAULTS;
  }
}

const tuning = createStore<ReliefTuning>(remembered());
let saying: ReturnType<typeof setTimeout> | null = null;

export const reliefTuningStore: Readable<ReliefTuning> = tuning;

export function setReliefTuning(change: Partial<ReliefTuning>): void {
  tuning.set(change);
  try {
    localStorage.setItem(KEPT, JSON.stringify(tuning.get()));
  } catch {
    // Not remembered across a reload, then; still in force until one.
  }
  if (saying !== null) {
    clearTimeout(saying);
  }
  saying = setTimeout(() => {
    saying = null;
    const said = Object.entries(tuning.get())
      .map(([name, value]) => `${name} ${Number(value.toFixed(2))}`)
      .join(', ');
    note('relief', `tuned: ${said}`);
  }, 700);
}

export function resetReliefTuning(): void {
  setReliefTuning(RELIEF_DEFAULTS);
}

import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../log/log';

/**
 * The rivers' own look, as numbers Adam moves with the sliders in the Water part of the debug panel's Shaders
 * section.
 *
 * Remembered in this browser, so a reload keeps them, and said once in the log after a slider stops moving, so
 * the log's copy button carries them to whoever is to write them down. Not a matter for the server: a way of
 * looking, like the fog switch. A store, read in a component through `useStore`.
 */
export interface RiverTuning {
  /** How fast the water runs, as a share of the speed `look.ts` gives a river of its size. */
  speed: number;
  /** How far apart the ripples are, in world units; rounded so a whole number of them fits the period. */
  spacing: number;
  /** How far the middle of a ripple runs ahead of its ends, in world units: a current fastest mid-river. */
  bow: number;
  /** How thin a ripple's crest is. */
  sharpness: number;
  /** How bright the ripples are, and the specks of light carried on the current. */
  ripples: number;
  specks: number;
  /** How much of the sea's own waves and caustics a river keeps. */
  waves: number;
  caustics: number;
}

export const RIVER_DEFAULTS: RiverTuning = {
  speed: 1,
  spacing: 4,
  bow: 1.15,
  sharpness: 21.5,
  ripples: 0.45,
  specks: 0.3,
  waves: 0.25,
  caustics: 0.4,
};

const KEPT = 'villages.water.rivers';

function remembered(): RiverTuning {
  try {
    const kept = localStorage.getItem(KEPT);
    if (kept === null) {
      return RIVER_DEFAULTS;
    }
    // Only the numbers there are now: one remembered from an older set of sliders is dropped.
    const parsed = JSON.parse(kept) as Record<string, unknown>;
    const known = Object.fromEntries(
      Object.keys(RIVER_DEFAULTS)
        .filter((key) => typeof parsed[key] === 'number')
        .map((key) => [key, parsed[key]]),
    );
    return { ...RIVER_DEFAULTS, ...known };
  } catch {
    return RIVER_DEFAULTS;
  }
}

const tuning = createStore<RiverTuning>(remembered());
let saying: ReturnType<typeof setTimeout> | null = null;

export const riverStore: Readable<RiverTuning> = tuning;

export function setRiverTuning(change: Partial<RiverTuning>): void {
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
    note('water', `rivers tuned: ${said}`);
  }, 700);
}

export function resetRiverTuning(): void {
  setRiverTuning(RIVER_DEFAULTS);
}

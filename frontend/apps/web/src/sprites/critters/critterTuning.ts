import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';

import { CRITTERS_LOOK } from './look';

/**
 * The critters' numbers that are a matter of taste, as Adam moves them with the sliders in the Critters part of the
 * debug panel's Shaders section. Remembered in this browser, and said once in the log after a slider stops, so the
 * log's copy button carries them to whoever is to write them down as the defaults in `look.ts`. A way of looking,
 * never sent: a lower density is a subset of the shared critters, never others.
 */
export interface CritterTuning {
  /** How many critters there are, from nought, none, to one, the most. */
  density: number;
  /** How big they are drawn, as times the sizes in `look.ts`. */
  size: number;
}

export const CRITTER_DEFAULTS: CritterTuning = { density: CRITTERS_LOOK.density, size: 1 };

const KEPT = 'villages.critters.tuning';

function remembered(): CritterTuning {
  try {
    const kept = localStorage.getItem(KEPT);
    if (kept === null) {
      return CRITTER_DEFAULTS;
    }
    // Only the numbers there are now: one remembered from an older set of sliders is dropped.
    const parsed = JSON.parse(kept) as Record<string, unknown>;
    const known = Object.fromEntries(
      Object.keys(CRITTER_DEFAULTS)
        .filter((key) => typeof parsed[key] === 'number')
        .map((key) => [key, parsed[key]]),
    );
    return { ...CRITTER_DEFAULTS, ...known };
  } catch {
    return CRITTER_DEFAULTS;
  }
}

const tuning = createStore<CritterTuning>(remembered());
let saying: ReturnType<typeof setTimeout> | null = null;

export const critterTuningStore: Readable<CritterTuning> = tuning;

export function setCritterTuning(change: Partial<CritterTuning>): void {
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
    note('critters', `critters tuned: ${said}`);
  }, 700);
}

export function resetCritterTuning(): void {
  setCritterTuning(CRITTER_DEFAULTS);
}

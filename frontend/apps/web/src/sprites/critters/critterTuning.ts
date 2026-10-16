import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';

import { CRITTERS_LOOK } from './look';

/**
 * The critters' numbers that are a matter of taste, as Adam moves them with the sliders in the Critters part of the
 * debug panel's Shaders section. Remembered in this browser, and said once in the log after a slider stops, so the
 * log's copy button carries them to whoever is to write them down as the defaults in `look.ts`. A way of looking,
 * never sent: a lower density is a subset of the shared critters, never others. How often is for looking at them, a
 * lever that makes the whole of a behaviour easy to see, and it is not remembered: every load is at one.
 */
export interface CritterTuning {
  /** How many critters there are, from nought, none, to one, the most. */
  density: number;
  /** How big they are drawn, as times the sizes in `look.ts`. */
  size: number;
  /** How often they come, as times how often they come for a player: one, up to twenty, to see a lot of them. */
  often: number;
}

export const CRITTER_DEFAULTS: CritterTuning = { density: CRITTERS_LOOK.density, size: 1, often: 1 };

/** The sliders a browser remembers: not how often, which is for looking and starts at one every time. */
const REMEMBERED: readonly (keyof CritterTuning)[] = ['density', 'size'];

// A key of its own since the sizes in look.ts took Adam's 60 per cent of 2026-10-16, so a size remembered from
// before is not taken a second time.
const KEPT = 'villages.critters.tuning.2';

function remembered(): CritterTuning {
  try {
    const kept = localStorage.getItem(KEPT);
    if (kept === null) {
      return CRITTER_DEFAULTS;
    }
    // Only the numbers there are now: one remembered from an older set of sliders is dropped.
    const parsed = JSON.parse(kept) as Record<string, unknown>;
    const known = Object.fromEntries(
      REMEMBERED.filter((key) => typeof parsed[key] === 'number').map((key) => [key, parsed[key]]),
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
    const kept = tuning.get();
    localStorage.setItem(KEPT, JSON.stringify(Object.fromEntries(REMEMBERED.map((key) => [key, kept[key]]))));
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

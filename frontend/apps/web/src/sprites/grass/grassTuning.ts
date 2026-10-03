import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';

/**
 * WIP SPIKE: how the grass grows in patches, as numbers Adam moves with the sliders in the Grass part of the debug
 * panel's Shaders section. Remembered in this browser, and said once in the log after a slider stops, so the
 * log's copy button carries them to whoever is to write them down. A way of looking, never sent.
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
};

const KEPT = 'villages.grass.tuning';

function remembered(): GrassTuning {
  try {
    const kept = localStorage.getItem(KEPT);
    if (kept === null) {
      return GRASS_DEFAULTS;
    }
    // Only the numbers there are now: one remembered from an older set of sliders is dropped.
    const parsed = JSON.parse(kept) as Record<string, unknown>;
    const known = Object.fromEntries(
      Object.keys(GRASS_DEFAULTS)
        .filter((key) => typeof parsed[key] === 'number')
        .map((key) => [key, parsed[key]]),
    );
    return { ...GRASS_DEFAULTS, ...known };
  } catch {
    return GRASS_DEFAULTS;
  }
}

const tuning = createStore<GrassTuning>(remembered());
let saying: ReturnType<typeof setTimeout> | null = null;

export const grassTuningStore: Readable<GrassTuning> = tuning;

export function setGrassTuning(change: Partial<GrassTuning>): void {
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
    note('grass', `grass tuned: ${said}`);
  }, 700);
}

export function resetGrassTuning(): void {
  setGrassTuning(GRASS_DEFAULTS);
}

import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';

import { TREES_LOOK } from './look';

/**
 * The trees' numbers that are a matter of taste, as Adam moves them with the sliders in the Trees part of the debug
 * panel's Shaders section. Remembered in this browser, and said once in the log after a slider stops, so the log's
 * copy button carries them to whoever is to write them down as the defaults in `look.ts`. A way of looking, never
 * sent: a browser whose sliders are not the defaults bends its trees its own way.
 */
export interface TreesTuning {
  /** How far the top of the bendiest kind moves down the wind in a whole gust, as a share of its height. */
  bend: number;
  /** How far the palest crown turns to its paler side in a whole gust, nought to one. */
  pale: number;
}

export const TREES_DEFAULTS: TreesTuning = { bend: TREES_LOOK.bend, pale: TREES_LOOK.pale };

const KEPT = 'villages.trees.tuning';

function remembered(): TreesTuning {
  try {
    const kept = localStorage.getItem(KEPT);
    if (kept === null) {
      return TREES_DEFAULTS;
    }
    // Only the numbers there are now: one remembered from an older set of sliders is dropped.
    const parsed = JSON.parse(kept) as Record<string, unknown>;
    const known = Object.fromEntries(
      Object.keys(TREES_DEFAULTS)
        .filter((key) => typeof parsed[key] === 'number')
        .map((key) => [key, parsed[key]]),
    );
    return { ...TREES_DEFAULTS, ...known };
  } catch {
    return TREES_DEFAULTS;
  }
}

const tuning = createStore<TreesTuning>(remembered());
let saying: ReturnType<typeof setTimeout> | null = null;

export const treesTuningStore: Readable<TreesTuning> = tuning;

export function setTreesTuning(change: Partial<TreesTuning>): void {
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
    note('trees', `trees tuned: ${said}`);
  }, 700);
}

export function resetTreesTuning(): void {
  setTreesTuning(TREES_DEFAULTS);
}

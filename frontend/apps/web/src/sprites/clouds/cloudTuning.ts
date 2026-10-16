import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';

import { CLOUD_LOOK } from './look';

/**
 * The clouds' numbers that are a matter of taste, as Adam moves them with the sliders in the Clouds part of the debug
 * panel's Shaders section. Remembered in this browser, and said once in the log after a slider stops, so the log's
 * copy button carries them to whoever is to write them down as the defaults in `look.ts`. A way of looking, never
 * sent: a browser whose sliders are not the defaults draws a sky of its own.
 */
export interface CloudTuning {
  /** How much of the sky is cloud, nought to one. */
  cover: number;
  /** How big the clumps are: the coarsest cell of the noise they are cut from, in world units. */
  size: number;
  /** How fast the wind carries them, in world units a second. */
  speed: number;
  /** How much faster than the clumps their detail drifts, so they change shape as they go: nought keeps them whole. */
  change: number;
  /** How much the patches decide where there is cloud, against the clumps themselves. */
  patches: number;
  /** How soft a cloud's edge is, in the field's own measure; never less than about a pixel. */
  edge: number;
  /** How dark a cloud's shadow is, nought to one. */
  shadow: number;
  /** How far from its cloud a shadow falls, away from the light, as a share of a clump. */
  reach: number;
  /** How far round a mark the clouds and their shadows keep clear, in pixels beyond the mark. */
  clearing: number;
  /** The zooms the bands change at: closer in than `inFrom` nothing is drawn, past `goneAt` nothing either. */
  inFrom: number;
  overFrom: number;
  fadeFrom: number;
  goneAt: number;
}

export const CLOUD_DEFAULTS: CloudTuning = {
  cover: CLOUD_LOOK.cover,
  size: CLOUD_LOOK.size,
  speed: CLOUD_LOOK.speed,
  change: CLOUD_LOOK.change,
  patches: CLOUD_LOOK.patches,
  edge: CLOUD_LOOK.edge,
  shadow: CLOUD_LOOK.shadow,
  reach: CLOUD_LOOK.reach,
  clearing: CLOUD_LOOK.clearing,
  ...CLOUD_LOOK.zooms,
};

const KEPT = 'villages.clouds.tuning';

function remembered(): CloudTuning {
  try {
    const kept = localStorage.getItem(KEPT);
    if (kept === null) {
      return CLOUD_DEFAULTS;
    }
    // Only the numbers there are now: one remembered from an older set of sliders is dropped.
    const parsed = JSON.parse(kept) as Record<string, unknown>;
    const known = Object.fromEntries(
      Object.keys(CLOUD_DEFAULTS)
        .filter((key) => typeof parsed[key] === 'number')
        .map((key) => [key, parsed[key]]),
    );
    return { ...CLOUD_DEFAULTS, ...known };
  } catch {
    return CLOUD_DEFAULTS;
  }
}

const tuning = createStore<CloudTuning>(remembered());
let saying: ReturnType<typeof setTimeout> | null = null;

export const cloudTuningStore: Readable<CloudTuning> = tuning;

export function setCloudTuning(change: Partial<CloudTuning>): void {
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
    note('clouds', `clouds tuned: ${said}`);
  }, 700);
}

export function resetCloudTuning(): void {
  setCloudTuning(CLOUD_DEFAULTS);
}

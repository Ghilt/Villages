import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../log/log';

/**
 * WIP SPIKE: how this window draws the water, a switch in the Debug map section that steps through the three.
 * Realistic at every load in this branch, because that is what the branch is for. A store, the one shape every
 * piece of state the page watches takes, read in a component through `useStore`.
 */
export type WaterMode = 'realistic' | 'wavelets' | 'still';

const ORDER: readonly WaterMode[] = ['realistic', 'wavelets', 'still'];

const SAID: Record<WaterMode, string> = {
  realistic: 'drawn with depth, waves, the sun, caustics and surf',
  wavelets: 'drawn as the first spike had it, little wavelets coming and going',
  still: 'still: the water is as painted',
};

const water = createStore<{ mode: WaterMode }>({ mode: 'realistic' });

export const waterStore: Readable<{ mode: WaterMode }> = water;

/** The next way of drawing it, round again after the last. */
export function nextWaterMode(): void {
  const mode = ORDER[(ORDER.indexOf(water.get().mode) + 1) % ORDER.length]!;
  note('water', SAID[mode]);
  water.set({ mode });
}

import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../log/log';

/**
 * Whether this window draws the water, and in which look: the Water part of the debug panel's Shaders section,
 * an enabled box and a choice of two. Drawn, and realistic, at every load. A store, the one shape every piece of
 * state the page watches takes, read in a component through `useStore`.
 */
export type WaterLook = 'realistic' | 'wavelets';

const SAID: Record<WaterLook, string> = {
  realistic: 'drawn with depth, waves, the sun, caustics and surf',
  wavelets: 'drawn as its first look, little stylised wavelets coming and going',
};

interface WaterState {
  enabled: boolean;
  look: WaterLook;
  /**
   * Whether the map is showing the Flow renderer, which the water layer draws in place of the water: which way
   * every river runs. Set by the renderer dropdown, whether the water is enabled or not.
   */
  flowView: boolean;
}

const water = createStore<WaterState>({ enabled: true, look: 'realistic', flowView: false });

export const waterStore: Readable<WaterState> = water;

export function setWaterEnabled(enabled: boolean): void {
  if (enabled === water.get().enabled) {
    return;
  }
  note('water', enabled ? SAID[water.get().look] : 'not drawn: the water is as painted');
  water.set({ enabled });
}

export function setWaterLook(look: WaterLook): void {
  if (look === water.get().look) {
    return;
  }
  note('water', SAID[look]);
  water.set({ look });
}

export function setFlowView(on: boolean): void {
  if (on !== water.get().flowView) {
    water.set({ flowView: on });
  }
}

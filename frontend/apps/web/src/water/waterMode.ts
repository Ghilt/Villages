import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../log/log';
import { sayLevel } from '../shaders/levels';
import type { ShaderLevel } from '../shaders/levels';

import { WATER_LOOK } from './look';

/**
 * How this window draws the water, and in which look: the Water part of the debug panel's Shaders section, its
 * level in the part's bar and a choice of two looks inside it. High and realistic at every load. A store, the one
 * shape every piece of state the page watches takes, read in a component through `useStore`.
 */
export type WaterLook = 'realistic' | 'wavelets';

const SAID: Record<WaterLook, string> = {
  realistic: 'drawn with depth, waves, the sun, caustics and surf',
  wavelets: 'drawn as its first look, little stylised wavelets coming and going',
};

interface WaterState {
  level: ShaderLevel;
  look: WaterLook;
  /**
   * Whether the map is showing the Flow renderer, which the water layer draws in place of the water: which way
   * every river runs. Set by the renderer dropdown, at whatever level the water is.
   */
  flowView: boolean;
}

const water = createStore<WaterState>({ level: 'high', look: 'realistic', flowView: false });

export const waterStore: Readable<WaterState> = water;

export function setWaterLevel(level: ShaderLevel): void {
  if (level === water.get().level) {
    return;
  }
  note('water', level === 'off' ? 'off: the water is as painted' : sayLevel(level, WATER_LOOK.levels[level]));
  water.set({ level });
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

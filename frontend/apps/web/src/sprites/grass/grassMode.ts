import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';

/**
 * WIP SPIKE: whether this window draws the grass, the Grass part of the debug panel's Shaders section. Drawn at
 * every load in this branch. A store, the one shape every piece of state the page watches takes.
 */
const grass = createStore({ enabled: true });

export const grassStore: Readable<{ enabled: boolean }> = grass;

export function setGrassEnabled(enabled: boolean): void {
  if (enabled === grass.get().enabled) {
    return;
  }
  note('grass', enabled ? 'the grass sways in the wind' : 'not drawn: the grassland is as painted');
  grass.set({ enabled });
}

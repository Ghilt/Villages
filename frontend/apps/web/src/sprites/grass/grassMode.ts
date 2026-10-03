import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';
import { sayLevel } from '../../shaders/levels';
import type { ShaderLevel } from '../../shaders/levels';

import { GRASS_LOOK } from './look';

/**
 * WIP SPIKE: how this window draws the grass, the level in the bar of the Grass part of the debug panel's
 * Shaders section. Low at every load in this branch. A store, the one shape every piece of state the page watches
 * takes.
 */
const grass = createStore<{ level: ShaderLevel }>({ level: 'low' });

export const grassStore: Readable<{ level: ShaderLevel }> = grass;

export function setGrassLevel(level: ShaderLevel): void {
  if (level === grass.get().level) {
    return;
  }
  note(
    'grass',
    level === 'off' ? 'off: the grassland is as painted' : sayLevel(level, GRASS_LOOK.levels[level]),
  );
  grass.set({ level });
}

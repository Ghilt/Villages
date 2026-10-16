import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';
import { sayLevel } from '../../shaders/levels';
import type { ShaderLevel } from '../../shaders/levels';

import { CLOUD_LOOK } from './look';

/**
 * How this window draws the clouds: their level, off, low or high, high at every load. A way of looking, neither
 * remembered nor sent. A store, the one shape every piece of state the page watches takes.
 */
const clouds = createStore<{ level: ShaderLevel }>({ level: 'high' });

export const cloudStore: Readable<{ level: ShaderLevel }> = clouds;

export function setCloudLevel(level: ShaderLevel): void {
  if (level === clouds.get().level) {
    return;
  }
  note('clouds', level === 'off' ? 'off: the sky is clear' : sayLevel(level, CLOUD_LOOK.levels[level]));
  clouds.set({ level });
}

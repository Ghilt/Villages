import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';
import type { ShaderLevel } from '../../shaders/levels';

import { TREES_LOOK } from './look';

/**
 * How this window draws the trees in the wind: their level, off, low or high, high at every load. A way of
 * looking, neither remembered nor sent. A store, the one shape every piece of state the page watches takes.
 */
const trees = createStore<{ level: ShaderLevel }>({ level: 'high' });

export const treesStore: Readable<{ level: ShaderLevel }> = trees;

export function setTreesLevel(level: ShaderLevel): void {
  if (level === trees.get().level) {
    return;
  }
  note(
    'trees',
    level === 'off'
      ? 'off: the trees stand still'
      : `${level}: the trees bend in the wind, ${TREES_LOOK.levels[level].framesPerSecond} frames a second`,
  );
  trees.set({ level });
}

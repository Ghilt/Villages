import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';

/**
 * WIP SPIKE: whether this window's grass sways, a switch in the Debug map section beside the water's. On at
 * every load in this branch. A store, the one shape every piece of state the page watches takes.
 */
const grass = createStore({ swaying: true });

export const grassStore: Readable<{ swaying: boolean }> = grass;

export function toggleGrass(): void {
  const swaying = !grass.get().swaying;
  note('grass', swaying ? 'the grass sways in the wind' : 'the grass is still: the ground is as painted');
  grass.set({ swaying });
}

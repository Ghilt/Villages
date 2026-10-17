import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';
import { sayLevel } from '../../shaders/levels';
import type { ShaderLevel } from '../../shaders/levels';

import { DRAWN } from './landMask';
import type { DrawnMotion } from './landMask';
import { LAND_LOOK } from './look';

/**
 * How this window draws the land: the level in the bar of the Land part of the debug panel's Shaders section, low at
 * every load, and the box of each of its folds, whether that motion is drawn, every one at every load. A way of
 * looking, neither remembered nor sent. A store, the one shape every piece of state the page watches takes.
 */
export interface LandState {
  level: ShaderLevel;
  shown: Readonly<Record<DrawnMotion, boolean>>;
}

const land = createStore<LandState>({
  level: 'low',
  shown: Object.fromEntries(DRAWN.map((motion) => [motion, true])) as Record<DrawnMotion, boolean>,
});

export const landStore: Readable<LandState> = land;

export function setLandLevel(level: ShaderLevel): void {
  if (level === land.get().level) {
    return;
  }
  note('land', level === 'off' ? 'off: the land is as painted' : sayLevel(level, LAND_LOOK.levels[level]));
  land.set({ level });
}

/** Draws a motion of the land, or leaves the land it moves on as painted. */
export function setLandShown(motion: DrawnMotion, shown: boolean): void {
  if (shown === land.get().shown[motion]) {
    return;
  }
  note('land', shown ? `${motion} drawn` : `${motion} not drawn: that land is as painted`);
  land.set({ shown: { ...land.get().shown, [motion]: shown } });
}

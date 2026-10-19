import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';

/**
 * Whether the ground worn bare under the buildings is drawn, how strongly, and in what earth. A store, read through
 * `useStore` as every switch is: the Structures section of the debug panel sets it and the sprites read it, and
 * nothing a player does moves it. Matters of taste, Adam's to settle by eye. See docs/plans/worked-ground.md.
 */
export interface WorkedGroundSettings {
  on: boolean;
  /** How much of the worn earth covers the painted ground, nought to one: a little of the paint always shows. */
  strength: number;
  /** The colour of the earth, as `#rrggbb`. */
  earth: string;
  /** How near two buildings stand, foot to foot in world units, for a path to join them: nought for none. */
  reach: number;
}

export const WORKED_GROUND_START: WorkedGroundSettings = {
  on: true,
  strength: 0.85,
  earth: '#806040',
  reach: 12,
};

const ground = createStore<WorkedGroundSettings>({ ...WORKED_GROUND_START });

export const workedGroundStore: Readable<WorkedGroundSettings> = ground;

export function setWorkedGround(change: Partial<WorkedGroundSettings>): void {
  const was = ground.get();
  const next = { ...was, ...change };
  if (
    next.on === was.on &&
    next.strength === was.strength &&
    next.earth === was.earth &&
    next.reach === was.reach
  ) {
    return;
  }
  if (next.on !== was.on) {
    note(
      'ground',
      next.on ? 'the buildings stand in worn ground' : 'the buildings stand on the painted ground',
    );
  }
  ground.set(next);
}

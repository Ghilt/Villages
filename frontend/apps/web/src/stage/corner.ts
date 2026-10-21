import type { BayLayout, Box } from './bayBox';

/**
 * How far in from the stage's right edge the corner's mark stands, the settings': at the edge in the bays, and in the
 * spread just clear of the column down the right edge when one is up, so it never stands on the column's tabs.
 */
export function cornerRight(stage: Box, box: BayLayout): number {
  return box.form === 'spread' ? stage.w - (box.bays.right?.x ?? stage.w) : 0;
}

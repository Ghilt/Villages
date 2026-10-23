/**
 * The podium's rules, kept apart from it so they are a test: a press held long enough lifts the die, a press that
 * wanders before then was meant for something else, and a die let go over its own slot goes back. See
 * `docs/plans/choice-roll-podium.md`, *Picked up, aimed and let go*.
 */

/** How long a press is held before the die lifts, in milliseconds: long enough that a tap never lifts it. */
export const LIFT_MS = 380;

/** How far, in pixels, a press may wander before the die lifts and still be one meant for it. */
export const WANDERS = 12;

export interface Spot {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Whether a press that began at `from` and is now at `to` has wandered off the die. */
export function wandered(from: Spot, to: Spot): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > WANDERS;
}

/** Whether a spot is over a box, its edges included: a die let go over its slot goes back into it. */
export function over(box: Box, at: Spot): boolean {
  return at.x >= box.left && at.x <= box.right && at.y >= box.top && at.y <= box.bottom;
}

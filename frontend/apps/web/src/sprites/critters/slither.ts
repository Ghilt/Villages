import { CRITTERS_LOOK } from './look';
import type { Animal, Cover, Pose } from './types';

/**
 * The slither: a snake gliding out of a tuft of the wet land's reeds or grass into another near it, low on the ground,
 * its way swinging gently from side to side and its body waving as it goes. It is seen from above, as the map is, so
 * its pose says which way it heads and the layer turns its picture to it; it runs on the ground, under the scenery, so
 * a tuft in front of it hides it, and it fades as it comes out of its cover and as it goes into the next, so it never
 * appears or vanishes in the open. Part of the critters' clock, `critterClock.ts`: a pure function of the draws its
 * cell and slot give it, the same in every browser.
 */

const S = CRITTERS_LOOK.slither;

/** The longest a slither lasts, so the slots before the current one that may still be gliding are asked too. */
export const SLITHER_LONGEST = S.reach[1] / S.speed;

/** How fast its swing goes round, in radians a second. */
const SWAY_RATE = Math.PI * 2 * S.swaysPerSecond;

const ramp = (from: number, to: number, value: number): number =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

/**
 * The one snake of a slither, gliding from its cover to one of the pieces near enough that `draw` picks, given nearest
 * first; null with nowhere near to go.
 */
export function slitherer(
  from: Cover,
  near: readonly Cover[],
  draw: (salt: number) => number,
): Animal | null {
  if (near.length === 0) return null;
  const to = near[Math.floor(draw(7) * near.length)]!;
  const away = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    heading: Math.atan2(to.y - from.y, to.x - from.x),
    delay: 0,
    reach: 1,
    phase: draw(8),
    to,
    seconds: away / S.speed,
    bow: (draw(9) - 0.5) * 2,
  };
}

/**
 * Where a snake is, `flown` seconds after it set off, for a strip of so many frames: along a path bowed a little to one
 * side, swinging from side to side of it and heading the way it swings, its frames waving its body as it goes, and
 * fading as it comes out of its cover and as it goes into the next.
 */
export function slitherPose(from: Cover, animal: Animal, flown: number, frames: number): Pose {
  const to = animal.to!;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const away = Math.hypot(dx, dy);
  const along = Math.min(1, flown / animal.seconds);
  // Its swing to either side, nought at both ends, and its bow, as a share of the way.
  const turn = SWAY_RATE * flown + Math.PI * 2 * animal.phase;
  const swing = Math.sin(turn);
  const ends = Math.sin(along * Math.PI);
  const side = (animal.bow * 0.1 * away * ends + S.sway * swing * ends) / Math.max(away, 1e-9);
  // Which way it heads: along its way, turned the way its swing is carrying it, as fast against how fast it glides.
  const swinging = (S.sway * SWAY_RATE * Math.cos(turn) * ends) / S.speed;
  return {
    x: from.x + dx * along - dy * side,
    y: from.y + dy * along + dx * side,
    height: 0,
    frame: Math.floor((flown + animal.phase) * S.wavesPerSecond) % Math.max(1, frames),
    alpha: Math.min(ramp(0, S.fade, flown), ramp(animal.seconds, animal.seconds - S.fade, flown)),
    heading: animal.heading + Math.atan(swinging),
  };
}

import { CRITTERS_LOOK } from './look';
import type { Animal, Cover, Pose, Ring } from './types';

/**
 * The leap: a fish jumping clear of the water and falling back, nose up as it rises and down as it falls, its tail
 * flicking, with a ring spreading on the water where it left and one where it fell. It comes out of no scenery but
 * the water itself, at a place of its cell the clock draws, and it leaps across the screen, east or west, so it is
 * seen from the side as its picture is. Part of the critters' clock, `critterClock.ts`: a pure function of the draws
 * its cell and slot give it, the same in every browser. The rings are drawn in code, not from a picture.
 */

const L = CRITTERS_LOOK;
const LP = L.leap;

/** The longest a leap lasts, the slowest jump and the last ring spreading after it. */
export const LEAP_LONGEST = LP.seconds[1] + LP.ring.seconds;

const between = ([least, most]: readonly [number, number], share: number): number =>
  least + (most - least) * share;

const ramp = (from: number, to: number, value: number): number =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

/**
 * The one fish of a leap: which way it jumps, east or west and a little either way, how far, from the least to the
 * most and higher the farther, its tail's own beat, and how long it lasts, its jump and the ring after it.
 */
export function leaper(draw: (salt: number) => number): Animal {
  const air = between(LP.seconds, draw(24));
  return {
    heading: (draw(22) < 0.5 ? 0 : Math.PI) + (draw(23) - 0.5) * 0.6,
    delay: 0,
    reach: draw(25),
    phase: draw(26),
    to: null,
    seconds: air + LP.ring.seconds,
    bow: 0,
  };
}

/** How long a fish is out of the water: the whole of a leap but the ring spreading after it. */
const airOf = (animal: Animal): number => animal.seconds - LP.ring.seconds;

/** Where a fish leaping from `from` lands. */
function landingOf(from: Cover, animal: Animal): { x: number; y: number } {
  const far = between(LP.reach, animal.reach);
  return { x: from.x + Math.cos(animal.heading) * far, y: from.y + Math.sin(animal.heading) * far };
}

/**
 * Where a leaping fish is, `flown` seconds after it left the water, for a strip of so many frames: along a high arc,
 * tilted along it, its tail flicking, coming clear of the water and going back in it fading; under the water, unseen,
 * once it has fallen back, while its ring spreads.
 */
export function leapPose(from: Cover, animal: Animal, flown: number, frames: number): Pose {
  const air = airOf(animal);
  const t = Math.min(1, flown / air);
  const far = between(LP.reach, animal.reach);
  const high = between(LP.high, animal.reach);
  return {
    x: from.x + Math.cos(animal.heading) * far * t,
    y: from.y + Math.sin(animal.heading) * far * t,
    height: high * 4 * t * (1 - t),
    frame: Math.floor((flown + animal.phase) * LP.flicksPerSecond) % Math.max(1, frames),
    alpha: flown >= air ? 0 : Math.min(ramp(0, LP.splash, flown), ramp(air, air - LP.splash, flown)),
    // Its nose follows the slope of its arc: up as it rises, level at the top, down as it falls.
    tilt: Math.atan2(high * 4 * (1 - 2 * t), far),
  };
}

/** The rings on the water of a leap, `flown` seconds after the fish left it: one where it left, one where it fell. */
export function leapRings(from: Cover, animal: Animal, flown: number): Ring[] {
  const landing = landingOf(from, animal);
  return [ringAt(from, flown), ringAt(landing, flown - airOf(animal))].filter((ring) => ring !== null);
}

/**
 * A ring spreading on the water at a place, `age` seconds after something went into it or came out, as wide as the
 * share of a fish's it is; null before it is made and once it is gone. A frog hopping into the water leaves one too.
 */
export function ringAt(at: { x: number; y: number }, age: number, wide = 1): Ring | null {
  const R = LP.ring;
  if (age <= 0 || age >= R.seconds) return null;
  const k = age / R.seconds;
  return {
    x: at.x,
    y: at.y,
    radius: (R.from + (R.to - R.from) * (1 - (1 - k) ** 2)) * wide,
    // Bright as it is made, within a moment, and fading as it spreads until it is gone.
    alpha: R.alpha * (1 - k) ** 1.5 * ramp(0, 0.08, age),
  };
}

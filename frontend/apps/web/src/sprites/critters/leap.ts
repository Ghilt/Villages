import { CRITTERS_LOOK } from './look';
import type { Animal, Cover, Pose, Ring } from './types';

/**
 * The leap: a fish jumping clear of the water and falling back, nose up as it rises and down as it falls, its tail
 * flicking, with a ring spreading on the water where it left and one where it fell; dolphins of the shallow sea doing
 * so in a row, one after another along the same way; and a whale far out on the ocean, which blows instead, its back
 * and a spout of spray standing up out of the sea in one place and falling back. It comes out of no scenery but the
 * water itself, at a place of its cell the clock draws, and it leaps across the screen, east or west, so it is seen
 * from the side as its picture is. Part of the critters' clock, `critterClock.ts`: a pure function of the draws its
 * cell and slot give it, the same in every browser. The rings are drawn in code, not from a picture.
 */

const L = CRITTERS_LOOK;
const LP = L.leap;

/** A leaping kind's numbers: the fish's, but for its own (`CRITTERS_LOOK.leap.kinds`). */
function leapOf(kind: string) {
  const own = LP.kinds[kind];
  return {
    reach: own?.reach ?? LP.reach,
    high: own?.high ?? LP.high,
    seconds: own?.seconds ?? LP.seconds,
    flicksPerSecond: own?.flicksPerSecond ?? LP.flicksPerSecond,
    pod: own?.pod ?? ([1, 1] as const),
    apart: own?.apart ?? 0,
    after: own?.after ?? 0,
    wide: own?.wide ?? 1,
    blows: own?.blows ?? false,
    fade: own?.fade ?? LP.splash,
  };
}

/** The longest a leap lasts, the last of a row of dolphins and the last ring spreading after it. */
export const LEAP_LONGEST = Math.max(
  ...['fish', ...Object.keys(LP.kinds)].map((kind) => {
    const look = leapOf(kind);
    return (look.pod[1] - 1) * look.after * 1.2 + look.seconds[1] + LP.ring.seconds;
  }),
);

const between = ([least, most]: readonly [number, number], share: number): number =>
  least + (most - least) * share;

const ramp = (from: number, to: number, value: number): number =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

/**
 * The one animal of a leap: which way it jumps, east or west and a little either way, how far, from the least to the
 * most and higher the farther, its tail's own beat, and how long it lasts, its jump and the ring after it. A fish's,
 * unless another kind is said.
 */
export function leaper(draw: (salt: number) => number, kind = 'fish'): Animal {
  const air = between(leapOf(kind).seconds, draw(24));
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

/**
 * The animals of a leap, as many as its kind comes up together: one fish or one whale, or a row of dolphins, each the
 * kind's `apart` behind the one before it along the way they go, a little to one side, and leaping `after` seconds
 * after it, near enough, so they come up one after another along the same line.
 */
export function leapersOf(kind: string, draw: (salt: number) => number): Animal[] {
  const look = leapOf(kind);
  const [fewest, most] = look.pod;
  const count = fewest + Math.floor(draw(27) * (most - fewest + 1));
  const first = leaper(draw, kind);
  return Array.from({ length: count }, (_, at) => {
    if (at === 0) return first;
    const own = (salt: number) => draw(salt + 40 * at);
    const back = look.apart * at;
    const aside = (own(28) - 0.5) * look.apart * 0.6;
    return {
      ...leaper(own, kind),
      heading: first.heading + (own(29) - 0.5) * 0.2,
      delay: look.after * at * (0.8 + 0.4 * own(30)),
      nudge: {
        x: -Math.cos(first.heading) * back - Math.sin(first.heading) * aside,
        y: -Math.sin(first.heading) * back + Math.cos(first.heading) * aside,
        height: 0,
      },
    };
  });
}

/** How long one is out of the water: the whole of a leap but the ring spreading after it. */
const airOf = (animal: Animal): number => animal.seconds - LP.ring.seconds;

/** Where one of a leap comes up, off the place the clock drew by as far as it is behind the first of a row. */
const startOf = (from: Cover, animal: Animal) => ({
  x: from.x + (animal.nudge?.x ?? 0),
  y: from.y + (animal.nudge?.y ?? 0),
});

/** Where one leaping from `start` lands. */
function landingOf(kind: string, start: { x: number; y: number }, animal: Animal): { x: number; y: number } {
  const far = between(leapOf(kind).reach, animal.reach);
  return { x: start.x + Math.cos(animal.heading) * far, y: start.y + Math.sin(animal.heading) * far };
}

/**
 * Where one of a leap is, `flown` seconds after it left the water, for a strip of so many frames: along a high arc,
 * tilted along it, its tail flicking, coming clear of the water and going back in it fading; under the water, unseen,
 * once it has fallen back, while its ring spreads. A whale blowing stays where it came up, its frames played through.
 */
export function leapPose(kind: string, from: Cover, animal: Animal, flown: number, frames: number): Pose {
  const look = leapOf(kind);
  const air = airOf(animal);
  const t = Math.min(1, flown / air);
  const start = startOf(from, animal);
  const alpha = (fade: number) =>
    flown >= air ? 0 : Math.min(ramp(0, fade, flown), ramp(air, air - fade, flown));
  if (look.blows) {
    return {
      ...start,
      height: 0,
      frame: Math.min(Math.max(1, frames) - 1, Math.floor(t * frames)),
      alpha: alpha(look.fade),
      tilt: 0,
    };
  }
  const far = between(look.reach, animal.reach);
  const high = between(look.high, animal.reach);
  return {
    x: start.x + Math.cos(animal.heading) * far * t,
    y: start.y + Math.sin(animal.heading) * far * t,
    height: high * 4 * t * (1 - t),
    frame: Math.floor((flown + animal.phase) * look.flicksPerSecond) % Math.max(1, frames),
    alpha: alpha(LP.splash),
    // Its nose follows the slope of its arc: up as it rises, level at the top, down as it falls.
    tilt: Math.atan2(high * 4 * (1 - 2 * t), far),
  };
}

/**
 * The rings on the water of a leap, `flown` seconds after it left it: one where it left, one where it fell; and where
 * a whale blew, one as its back goes under.
 */
export function leapRings(kind: string, from: Cover, animal: Animal, flown: number): Ring[] {
  const look = leapOf(kind);
  const start = startOf(from, animal);
  if (look.blows) {
    const ring = ringAt(start, flown - airOf(animal) * 0.7, look.wide);
    return ring === null ? [] : [ring];
  }
  const landing = landingOf(kind, start, animal);
  return [ringAt(start, flown, look.wide), ringAt(landing, flown - airOf(animal), look.wide)].filter(
    (ring) => ring !== null,
  );
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

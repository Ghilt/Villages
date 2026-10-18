import { DOWN_WIND } from '../wind';

import { CRITTERS_LOOK } from './look';
import type { SoarLook } from './look';
import type { Animal, Cover, Pose } from './types';

/**
 * The soar: a bird circling slowly high over open ground, a hawk, or gulls wheeling low and quick over the shallow sea,
 * gliding with a beat of its wings now and then, its
 * circle drifting down the world's one wind (`../wind.ts`), coming and going slowly far up so it never pops. It comes
 * out of no scenery but the open ground at a place of its cell the clock draws, as a fish comes out of the water. It is
 * seen from above, as the map is, so its pose says which way it flies and the layer turns its picture to it; its
 * shadow falls on the ground below it and away from the light, under the trees. Part of the critters' clock,
 * `critterClock.ts`: a pure function of the draws its cell and slot give it, the same in every browser.
 */

const S = CRITTERS_LOOK.soar;

/** A soaring kind's numbers: the hawk's, but for its own (`CRITTERS_LOOK.soar.kinds`). */
const soarOf = (kind: string): SoarLook => ({ ...S, ...S.kinds[kind] });

/** The longest a soar lasts, so the slots before the current one that may still be circling are asked too. */
export const SOAR_LONGEST = Math.max(
  S.seconds[1],
  ...Object.keys(S.kinds).map((kind) => soarOf(kind).seconds[1]),
);

const between = ([least, most]: readonly [number, number], share: number): number =>
  least + (most - least) * share;

const ramp = (from: number, to: number, value: number): number =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

/**
 * The one bird of a soar: where on its circle it starts, which way round it goes, how wide its circle is and how high,
 * its own beat, and how long it is in sight. A hawk's, unless another kind is said.
 */
export function soarer(draw: (salt: number) => number, kind = 'hawk'): Animal {
  return {
    heading: draw(22) * Math.PI * 2,
    delay: 0,
    reach: draw(25),
    phase: draw(26),
    to: null,
    seconds: between(soarOf(kind).seconds, draw(24)),
    bow: draw(23) < 0.5 ? -1 : 1,
  };
}

/**
 * The birds of a soar, as many as its kind circles together: one hawk, or two or three crows over a ruin, each on a
 * circle of its own over the same place. The first is drawn as a lone bird is, so a hawk is the hawk it always was.
 */
export function soarersOf(kind: string, draw: (salt: number) => number): Animal[] {
  const [fewest, most] = CRITTERS_LOOK.kinds[kind]?.together ?? [1, 1];
  const count = fewest + Math.floor(draw(27) * (most - fewest + 1));
  return Array.from({ length: count }, (_, at) =>
    soarer(at === 0 ? draw : (salt) => draw(salt + 30 * at), kind),
  );
}

/**
 * Where a soaring bird is, `flown` seconds after it came into sight above `from`, for a strip of so many frames: round
 * its circle, which drifts down the wind, high above the ground and rising and falling a little as it goes, gliding but
 * for a beat now and then, and fading as it comes and goes.
 */
export function soarPose(kind: string, from: Cover, animal: Animal, flown: number, frames: number): Pose {
  const S = soarOf(kind);
  const radius = between(S.radius, animal.reach);
  const turning = ((Math.PI * 2) / S.circleSeconds) * animal.bow;
  const round = animal.heading + turning * flown;
  const drift = S.drift * flown;
  const beating = Math.sin((flown + animal.phase * 13) * 0.7) > 1 - 2 * S.flapping;
  return {
    x: from.x + Math.cos(round) * radius + DOWN_WIND.east * drift,
    y: from.y + Math.sin(round) * radius + DOWN_WIND.south * drift,
    height: between(S.high, animal.phase) + 0.4 * Math.sin(round * 0.5 + animal.phase * 6),
    frame: beating ? Math.floor((flown + animal.phase) * S.flapsPerSecond * 2) % Math.max(1, frames) : 0,
    alpha: Math.min(ramp(0, S.fade, flown), ramp(animal.seconds, animal.seconds - S.fade, flown)),
    // Along its circle, the way round it goes, ahead of where it is.
    heading: round + (Math.sign(turning) * Math.PI) / 2,
  };
}

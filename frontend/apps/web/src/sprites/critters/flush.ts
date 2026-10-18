import { CRITTERS_LOOK } from './look';
import type { Animal, Cover, CritterEvent, Pose } from './types';

/**
 * The flush: a flock bursting out of cover together, fanning out like a shotgun's blast, climbing, flapping and gliding
 * away on an arc as a flock turns, hooking down at the end and fading; or a bird or two flitting from one tree into
 * another near it, seeking shelter, some of a burst's birds dropping into a tree near by too. Part of the critters'
 * clock, `critterClock.ts`: a pure function of the draws its cell and slot give it, the same in every browser.
 */

const F = CRITTERS_LOOK.flush;

/** The longest a flush lasts, the last bird of a flock flying off or taking shelter. */
export const FLUSH_LONGEST = F.stagger + Math.max(F.seconds, F.shelterSeconds[1]);

const ramp = (from: number, to: number, value: number): number =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

/**
 * The birds of a flush out of `from`, given the trees near it they could take shelter in: a bird or two flitting into
 * one of them, or a flock bursting out and fanning, some of it dropping into one, as many as the flush's flock or as
 * the kind's own number says. Every bird flying off bends the same way, by much the same, so the flock turns together.
 */
export function flockOf(
  from: Cover,
  near: readonly Cover[],
  flit: boolean,
  draw: (salt: number) => number,
  [fewest, most]: readonly [number, number] = F.flock,
): Animal[] {
  const count = flit ? (draw(3) < 0.3 ? 2 : 1) : fewest + Math.floor(draw(3) * (most - fewest + 1));
  const heading = draw(4) * Math.PI * 2;
  const spread = (F.spread * Math.PI) / 180;
  const [quickest, slowest] = F.shelterSeconds;
  // Which way the flock turns, and how hard, as one: each bird a little more or a little less.
  const turn = (draw(7) < 0.5 ? -1 : 1) * (0.55 + 0.45 * draw(8));
  return Array.from({ length: count }, (_, at) => {
    const salt = 10 + at * 6;
    const settles = near.length > 0 && (flit || draw(salt + 4) < F.settle);
    const to = settles ? near[Math.floor(draw(salt + 5) * near.length)]! : null;
    const away = to === null ? 0 : Math.hypot(to.x - from.x, to.y - from.y);
    // Where in the fan it is, from minus one on one side to one on the other.
    const side = count === 1 ? 0 : (at / (count - 1) - 0.5) * 2;
    // A little apart in the crown, each from where it sat: draws of its own, past every other bird's.
    const apart = (one: number) => (draw(200 + at * 3 + one) - 0.5) * 2 * F.scatter;
    return {
      heading:
        to !== null
          ? Math.atan2(to.y - from.y, to.x - from.x)
          : heading + (spread * side) / 2 + (draw(salt) - 0.5) * 0.1,
      delay: at === 0 ? 0 : draw(salt + 1) * F.stagger,
      reach: 0.8 + draw(salt + 2) * 0.4,
      phase: draw(salt + 3),
      to,
      seconds: to === null ? F.seconds : Math.min(slowest, Math.max(quickest, away / F.shelterSpeed)),
      // A bird taking shelter bows either way; one flying off turns with the flock.
      bow:
        to !== null
          ? (draw(salt) - 0.5) * 2
          : Math.max(-1, Math.min(1, turn * (0.85 + 0.3 * draw(salt + 5)))),
      ...(to === null ? { nudge: { x: apart(0), y: apart(1), height: apart(2) } } : {}),
    };
  });
}

/**
 * Where a bird of a flush is, `flown` seconds after it left, for a picture of so many frames standing `size` world
 * units tall. A bird flying off comes out of its cover, climbs and flies away on an arc, turning with the rest of its
 * flock, flapping and then gliding, flapping again now and then, and then hooks: a sharp turn and a drop of a little
 * over half a bird length straight down the screen, settling, and then fades quickly. A bird taking shelter flies a
 * bowed path from one crown to the other, rising and dropping, gliding at the top, and fades as it goes into the
 * leaves. Each comes out of its cover whole within a moment, so none of it ever appears or vanishes in the open.
 */
export function flushPose(
  event: CritterEvent,
  bird: Animal,
  flown: number,
  frames: number,
  size: number,
): Pose {
  const crown = event.from.height * 0.75;
  const share = flown / bird.seconds;
  const beat = Math.floor((flown + bird.phase) * F.flapsPerSecond);
  const out = ramp(0, F.fadeIn * F.seconds, flown);
  if (bird.to !== null) return shelterPose(event.from, bird, share, crown, out, beat, frames);
  // Whole through the turn and the drop, and fading quickly once it has settled.
  const alpha = Math.min(out, ramp(1, 1 - F.fadeOut, share));
  // From where it sat in its cover, a little apart from the rest.
  const start = { x: event.from.x + (bird.nudge?.x ?? 0), y: event.from.y + (bird.nudge?.y ?? 0) };
  const sat = crown + (bird.nudge?.height ?? 0);
  if (share > F.hookAt) return hookPose(start, bird, share, sat, alpha, beat, frames, size);
  const on = arcAt(start, bird, F.reach * bird.reach * share ** 0.85);
  // Flapping for the first part of the flight, then gliding, with a beat now and then.
  const flapping = share < F.flapping || Math.sin((flown + bird.phase * 7) * 2.1) > 0.6;
  return {
    x: on.x,
    y: on.y,
    height: sat + F.climb * Math.sin((share * Math.PI) / 2),
    frame: flapping ? pingPong(beat, frames) : Math.floor(frames / 2),
    alpha,
  };
}

/**
 * Where a bird flying off is on the ground, `along` world units out from its cover, and which way it is going: its
 * heading turns steadily as it flies, the way its bow says, by up to `arc` over the flight to the hook, so its path is
 * an arc of a circle.
 */
function arcAt(
  from: { x: number; y: number },
  bird: Animal,
  along: number,
): { x: number; y: number; heading: number } {
  const whole = F.reach * bird.reach * F.hookAt ** 0.85;
  const bend = (F.arc * bird.bow) / whole;
  const heading = bird.heading + bend * along;
  if (Math.abs(bend) < 1e-9) {
    return { x: from.x + Math.cos(heading) * along, y: from.y + Math.sin(heading) * along, heading };
  }
  return {
    x: from.x + (Math.sin(heading) - Math.sin(bird.heading)) / bend,
    y: from.y - (Math.cos(heading) - Math.cos(bird.heading)) / bend,
    heading,
  };
}

/**
 * A bird flying off, past where it hooks: on the way its arc has brought it for a moment, braking into the turn, and
 * then straight down the screen, which is down in height, since what flies stands up the screen as the scenery does, so
 * the turn is the same whichever way the camera is turned.
 */
function hookPose(
  from: { x: number; y: number },
  bird: Animal,
  share: number,
  crown: number,
  alpha: number,
  beat: number,
  frames: number,
  size: number,
): Pose {
  const at = F.hookAt;
  // How far through the turn and the drop, which are done by the time it starts to fade, and held while it does.
  const k = Math.min(1, (share - at) / (1 - F.fadeOut - at));
  const turned = arcAt(from, bird, F.reach * bird.reach * at ** 0.85);
  const on = F.hookTurn * size * (1 - (1 - Math.min(1, k / F.hookTurning)) ** 2);
  const high = crown + F.climb * Math.sin((at * Math.PI) / 2);
  return {
    x: turned.x + Math.cos(turned.heading) * on,
    y: turned.y + Math.sin(turned.heading) * on,
    height: high - F.hookDrop * size * ramp(F.hookTurning / 3, 1, k) ** 1.4,
    frame: pingPong(beat, frames),
    alpha,
  };
}

/** A bird on its way to shelter, a share of the way there: along a bowed path, over an arc, and into the crown. */
function shelterPose(
  from: Cover,
  bird: Animal,
  share: number,
  crown: number,
  out: number,
  beat: number,
  frames: number,
): Pose {
  const to = bird.to!;
  const t = share * share * (3 - 2 * share);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // The path bows to one side of the straight line by up to a third of its length: a quadratic curve.
  const bendX = (from.x + to.x) / 2 - dy * 0.3 * bird.bow;
  const bendY = (from.y + to.y) / 2 + dx * 0.3 * bird.bow;
  const rise = Math.min(2, Math.hypot(dx, dy) * 0.25);
  const gliding = share > 0.4 && share < 0.65;
  return {
    x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * bendX + t * t * to.x,
    y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * bendY + t * t * to.y,
    height: crown + (to.height * 0.75 - crown) * t + rise * Math.sin(share * Math.PI),
    frame: gliding ? Math.floor(frames / 2) : pingPong(beat, frames),
    alpha: Math.min(out, ramp(1, 1 - F.settleIn, share)),
  };
}

/** A frame of a strip played forwards and back: nought, one, two, one, nought for three. */
function pingPong(beat: number, frames: number): number {
  if (frames <= 1) return 0;
  const round = (frames - 1) * 2;
  const at = ((beat % round) + round) % round;
  return at < frames ? at : round - at;
}

import { CASTS, memberOf } from './casts';
import type { Behaviour } from './casts';
import { CRITTERS_LOOK } from './look';

/**
 * When and where the critters are: a pure function of the place and the wall clock, so nothing about them is
 * remembered or sent and every browser works out the same ones at the same moment, as every browser draws the same
 * sky. The ground is cut into cells and the clock into slots; a hash of a cell and a slot says whether anything comes
 * there then, out of which piece of the scenery standing in the cell, which of that ground's cast, when in the slot,
 * and everything about how it goes. After that it is a function of the seconds since it began. See
 * docs/plans/living-world.md.
 *
 * Whether a cell's slot brings anything is decided by one draw against the density before anything else, so turning
 * the density down only ever takes critters away: fewer is a subset of more. The density may be more than one, which
 * is how often times how many, for looking at them: at its most, every cell's slot brings something. A critter's identity is its cell and
 * its slot, so however the view is cut into cells to ask, the same critter is the same.
 */

const L = CRITTERS_LOOK;
const F = L.flush;

/** A piece of the scenery a critter can come out of: where it stands, what kind it is, and how tall. */
export interface Cover {
  x: number;
  y: number;
  kind: string;
  height: number;
}

/** What the clock needs to know about the ground. */
export interface Ground {
  /** The scenery standing in a square of world units, in its own order; null while it is not yet known. */
  coverIn(fromX: number, fromY: number, toX: number, toY: number): readonly Cover[] | null;
  /** The terrain class at a place, by its name in `world/palette.json`, or null where there is none. */
  classAt(x: number, y: number): string | null;
  /** Whether the house sees the place now. Critters are only where it does. */
  sees(x: number, y: number): boolean;
}

/**
 * One bird of a flock: which way it flies, how long after the first it leaves, how far, its own wingbeat, and the
 * tree it takes shelter in, if it does, with how long it takes to get there and which way its path bows.
 */
export interface FlockBird {
  /** On the ground, in radians from east towards south, as world units run. */
  heading: number;
  delay: number;
  /** A share of the flock's reach. */
  reach: number;
  phase: number;
  /** The tree or bush it drops into; null for a bird that flies off and fades. */
  to: Cover | null;
  seconds: number;
  /** From one side to the other, minus one to one. */
  bow: number;
}

export interface CritterEvent {
  /** Its identity: the cell and the slot it came out of. */
  key: string;
  kind: string;
  behaviour: Behaviour;
  /** When it begins, in seconds of the wall clock since 1970. */
  startsAt: number;
  /** What it comes out of. */
  from: Cover;
  birds: readonly FlockBird[];
}

/** Where one critter is at a moment: the ground under it, how high above that, which frame, and how much of it. */
export interface Pose {
  x: number;
  y: number;
  height: number;
  frame: number;
  alpha: number;
}

/** A number from nought to one for a cell, a slot and a salt: the same everywhere, for ever. */
export function critterHash(cellX: number, cellY: number, slot: number, salt: number): number {
  let h =
    Math.imul(cellX | 0, 0x27d4eb2d) ^
    Math.imul(cellY | 0, 0x165667b1) ^
    Math.imul(slot | 0, 0x9e3779b1) ^
    Math.imul(salt | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The cell a place in world units falls in. */
export function critterCellOf(units: number): number {
  return Math.floor(units / L.cell);
}

/** The slot of the wall clock a moment, in seconds since 1970, falls in. */
export function slotOf(seconds: number): number {
  return Math.floor(seconds / L.slot);
}

/** How long a critter lasts from its start until the last of it is gone. */
export function lastsFor(event: CritterEvent): number {
  return Math.max(...event.birds.map((bird) => bird.delay + bird.seconds));
}

/** The longest anything lasts, so the slots before the current one that can still be in flight are asked too. */
const LONGEST = F.stagger + Math.max(F.seconds, F.shelterSeconds[1]);

/**
 * The trees and bushes near a bird's cover that it could take shelter in, nearest first, up to five; null while the
 * ground round it is not all known, so a browser that knows less waits rather than sending its birds elsewhere.
 */
function shelterNear(from: Cover, kinds: readonly string[], ground: Ground): Cover[] | null {
  const [least, most] = F.shelter;
  const around = ground.coverIn(from.x - most, from.y - most, from.x + most, from.y + most);
  if (around === null) return null;
  const away = (one: Cover) => Math.hypot(one.x - from.x, one.y - from.y);
  return around
    .filter(
      (one) =>
        kinds.includes(one.kind) && away(one) >= least && away(one) <= most && ground.sees(one.x, one.y),
    )
    .sort((one, other) => away(one) - away(other) || one.y - other.y || one.x - other.x)
    .slice(0, 5);
}

/** What a cell's slot brings, if anything, at this density: how many, nought to one, times how often. */
export function eventIn(
  cellX: number,
  cellY: number,
  slot: number,
  density: number,
  ground: Ground,
): CritterEvent | null {
  if (critterHash(cellX, cellY, slot, 0) >= Math.min(1, L.chance * Math.max(0, density))) return null;
  const fromX = cellX * L.cell;
  const fromY = cellY * L.cell;
  const cover = ground.coverIn(fromX, fromY, fromX + L.cell, fromY + L.cell);
  if (cover === null || cover.length === 0) return null;
  const sorted = [...cover].sort((one, other) => one.y - other.y || one.x - other.x);
  const from = sorted[Math.floor(critterHash(cellX, cellY, slot, 1) * sorted.length)]!;
  const land = ground.classAt(from.x, from.y);
  const member = memberOf(land === null ? undefined : CASTS[land], critterHash(cellX, cellY, slot, 2));
  if (member === null || !member.from.includes(from.kind) || !ground.sees(from.x, from.y)) return null;
  const near = shelterNear(from, member.from, ground);
  if (near === null) return null;
  // A bird or two flitting to shelter, or a flock bursting out; a flit needs a tree to go to.
  const flit = critterHash(cellX, cellY, slot, 6) < F.flits;
  if (flit && near.length === 0) return null;
  const pair = critterHash(cellX, cellY, slot, 3) < 0.3;
  const count = flit
    ? pair
      ? 2
      : 1
    : F.flock[0] + Math.floor(critterHash(cellX, cellY, slot, 3) * (F.flock[1] - F.flock[0] + 1));
  const heading = critterHash(cellX, cellY, slot, 4) * Math.PI * 2;
  const spread = (F.spread * Math.PI) / 180;
  const [quickest, slowest] = F.shelterSeconds;
  const birds = Array.from({ length: count }, (_, at) => {
    const salt = 10 + at * 6;
    const settles = near.length > 0 && (flit || critterHash(cellX, cellY, slot, salt + 4) < F.settle);
    const to = settles ? near[Math.floor(critterHash(cellX, cellY, slot, salt + 5) * near.length)]! : null;
    const away = to === null ? 0 : Math.hypot(to.x - from.x, to.y - from.y);
    return {
      heading:
        to !== null
          ? Math.atan2(to.y - from.y, to.x - from.x)
          : heading +
            spread * (count === 1 ? 0 : at / (count - 1) - 0.5) +
            (critterHash(cellX, cellY, slot, salt) - 0.5) * 0.3,
      delay: at === 0 ? 0 : critterHash(cellX, cellY, slot, salt + 1) * F.stagger,
      reach: 0.8 + critterHash(cellX, cellY, slot, salt + 2) * 0.4,
      phase: critterHash(cellX, cellY, slot, salt + 3),
      to,
      seconds: to === null ? F.seconds : Math.min(slowest, Math.max(quickest, away / F.shelterSpeed)),
      bow: (critterHash(cellX, cellY, slot, salt) - 0.5) * 2,
    };
  });
  return {
    key: `${cellX}/${cellY}/${slot}`,
    kind: member.kind,
    behaviour: member.behaviour,
    startsAt: slot * L.slot + critterHash(cellX, cellY, slot, 5) * L.slot,
    from,
    birds,
  };
}

/** Every critter in flight at this moment over these cells, inclusive, at this density. */
export function eventsAt(
  cells: { fromX: number; toX: number; fromY: number; toY: number },
  seconds: number,
  density: number,
  ground: Ground,
): CritterEvent[] {
  if (density <= 0) return [];
  const events: CritterEvent[] = [];
  for (let slot = slotOf(seconds - LONGEST); slot <= slotOf(seconds); slot += 1) {
    for (let cellY = cells.fromY; cellY <= cells.toY; cellY += 1) {
      for (let cellX = cells.fromX; cellX <= cells.toX; cellX += 1) {
        const event = eventIn(cellX, cellY, slot, density, ground);
        if (event !== null && seconds >= event.startsAt && seconds < event.startsAt + lastsFor(event)) {
          events.push(event);
        }
      }
    }
  }
  return events;
}

const ramp = (from: number, to: number, value: number): number =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

/**
 * Where every bird of a flock is at this moment, for a picture of so many frames. A bird flying off comes out of its
 * cover, climbs and flies away down its own heading, flapping and then gliding, flapping again now and then, and
 * fades as it goes. A bird taking shelter flies a bowed path from one crown to the other, rising and dropping,
 * gliding at the top, and fades as it goes into the leaves. Each comes out of its cover whole within a moment, so
 * none of it ever appears or vanishes in the open.
 */
export function posesOf(event: CritterEvent, seconds: number, frames: number): Pose[] {
  const poses: Pose[] = [];
  const crown = event.from.height * 0.75;
  for (const bird of event.birds) {
    const flown = seconds - event.startsAt - bird.delay;
    const share = flown / bird.seconds;
    if (share <= 0 || share >= 1) continue;
    const beat = Math.floor((flown + bird.phase) * F.flapsPerSecond);
    const out = ramp(0, F.fadeIn * F.seconds, flown);
    if (bird.to !== null) {
      poses.push(shelterPose(event.from, bird, share, crown, out, beat, frames));
      continue;
    }
    const along = F.reach * bird.reach * share ** 0.85;
    // Flapping for the first part of the flight, then gliding, with a beat now and then.
    const flapping = share < F.flapping || Math.sin((flown + bird.phase * 7) * 2.1) > 0.6;
    poses.push({
      x: event.from.x + Math.cos(bird.heading) * along,
      y: event.from.y + Math.sin(bird.heading) * along,
      height: crown + F.climb * Math.sin((share * Math.PI) / 2),
      frame: flapping ? pingPong(beat, frames) : Math.floor(frames / 2),
      alpha: Math.min(out, ramp(1, 1 - F.fadeOut, share)),
    });
  }
  return poses;
}

/** A bird on its way to shelter, a share of the way there: along a bowed path, over an arc, and into the crown. */
function shelterPose(
  from: Cover,
  bird: FlockBird,
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

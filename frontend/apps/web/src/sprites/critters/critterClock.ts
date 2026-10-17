import { CASTS, memberOf } from './casts';
import { HOP_LONGEST, hopPose, hopper } from './hop';
import { LEAP_LONGEST, leapPose, leapRings, leaper } from './leap';
import { CRITTERS_LOOK } from './look';
import type { Animal, Cover, CritterEvent, Ground, Pose, Ring } from './types';

export type { Animal, Cover, CritterEvent, Ground, Pose, Ring } from './types';

/**
 * When and where the critters are: a pure function of the place and the wall clock, so nothing about them is
 * remembered or sent and every browser works out the same ones at the same moment, as every browser draws the same
 * sky. The ground is cut into cells and the clock into slots; a hash of a cell and a slot says whether anything comes
 * there then, out of which piece of the scenery standing in the cell, which of that ground's cast, when in the slot,
 * and everything about how it goes: a flock bursting out of cover, here, a small animal hopping to the next piece of
 * cover, `hop.ts`, or a fish jumping out of the water, `leap.ts`, which comes out of no scenery but the water at a
 * place of the cell drawn for it. After that it is a function of the seconds since it began. See
 * docs/plans/living-world.md.
 *
 * Whether a cell's slot brings anything is decided by one draw against the density before anything else, so turning
 * the density down only ever takes critters away: fewer is a subset of more. The density may be more than one, which
 * is how often times how many, for looking at them: at its most, every cell's slot brings something. A critter's identity is its cell and
 * its slot, so however the view is cut into cells to ask, the same critter is the same.
 */

const L = CRITTERS_LOOK;
const F = L.flush;

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
  return Math.max(...event.animals.map((animal) => animal.delay + animal.seconds));
}

/** The longest anything lasts, so the slots before the current one that can still be in flight are asked too. */
const LONGEST = Math.max(F.stagger + Math.max(F.seconds, F.shelterSeconds[1]), HOP_LONGEST, LEAP_LONGEST);

/**
 * The trees and bushes near a critter's cover, as near and as far as said, that it could go into, nearest first, up
 * to five; null while the ground round it is not all known, so a browser that knows less waits rather than sending
 * it elsewhere.
 */
export function coverNear(
  from: Cover,
  kinds: readonly string[],
  ground: Ground,
  [least, most]: readonly [number, number],
): Cover[] | null {
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
  const draw = (salt: number) => critterHash(cellX, cellY, slot, salt);
  const key = `${cellX}/${cellY}/${slot}`;
  const startsAt = slot * L.slot + draw(5) * L.slot;
  // A fish needs no cover: a place of the cell is drawn, and where the water there has fish, one leaps from it.
  const at = { x: fromX + draw(20) * L.cell, y: fromY + draw(21) * L.cell };
  const water = ground.classAt(at.x, at.y);
  const fish = water === null ? null : memberOf(CASTS[water], draw(2));
  if (fish?.behaviour === 'leap') {
    if (!ground.sees(at.x, at.y)) return null;
    const from = { ...at, kind: water!, height: 0 };
    return { key, kind: fish.kind, behaviour: 'leap', startsAt, from, animals: [leaper(draw)] };
  }
  const cover = ground.coverIn(fromX, fromY, fromX + L.cell, fromY + L.cell);
  if (cover === null || cover.length === 0) return null;
  const sorted = [...cover].sort((one, other) => one.y - other.y || one.x - other.x);
  const from = sorted[Math.floor(critterHash(cellX, cellY, slot, 1) * sorted.length)]!;
  const land = ground.classAt(from.x, from.y);
  const member = memberOf(land === null ? undefined : CASTS[land], critterHash(cellX, cellY, slot, 2));
  if (member === null || !member.from.includes(from.kind) || !ground.sees(from.x, from.y)) return null;
  if (member.behaviour === 'hop') {
    // One animal bounding to cover near by; with none near enough, nothing comes.
    const near = coverNear(from, member.from, ground, L.hop[member.kind]?.reach ?? [0, 0]);
    if (near === null) return null;
    const animal = hopper(member.kind, from, near, draw);
    if (animal === null) return null;
    return { key, kind: member.kind, behaviour: 'hop', startsAt, from, animals: [animal] };
  }
  const near = coverNear(from, member.from, ground, F.shelter);
  if (near === null) return null;
  // A bird or two flitting to shelter, or a flock bursting out; a flit needs a tree to go to.
  const flit = draw(6) < F.flits;
  if (flit && near.length === 0) return null;
  return {
    key,
    kind: member.kind,
    behaviour: member.behaviour,
    startsAt,
    from,
    animals: flockOf(from, near, flit, draw),
  };
}

/**
 * The birds of a flush out of `from`, given the trees near it they could take shelter in: a bird or two flitting into
 * one of them, or a flock bursting out and fanning, some of it dropping into one.
 */
export function flockOf(
  from: Cover,
  near: readonly Cover[],
  flit: boolean,
  draw: (salt: number) => number,
): Animal[] {
  const count = flit
    ? draw(3) < 0.3
      ? 2
      : 1
    : F.flock[0] + Math.floor(draw(3) * (F.flock[1] - F.flock[0] + 1));
  const heading = draw(4) * Math.PI * 2;
  const spread = (F.spread * Math.PI) / 180;
  const [quickest, slowest] = F.shelterSeconds;
  return Array.from({ length: count }, (_, at) => {
    const salt = 10 + at * 6;
    const settles = near.length > 0 && (flit || draw(salt + 4) < F.settle);
    const to = settles ? near[Math.floor(draw(salt + 5) * near.length)]! : null;
    const away = to === null ? 0 : Math.hypot(to.x - from.x, to.y - from.y);
    // Where in the fan it is, from minus one on one side to one on the other.
    const side = count === 1 ? 0 : (at / (count - 1) - 0.5) * 2;
    return {
      heading:
        to !== null
          ? Math.atan2(to.y - from.y, to.x - from.x)
          : heading + (spread * side) / 2 + (draw(salt) - 0.5) * 0.3,
      delay: at === 0 ? 0 : draw(salt + 1) * F.stagger,
      reach: 0.8 + draw(salt + 2) * 0.4,
      phase: draw(salt + 3),
      to,
      seconds: to === null ? F.seconds : Math.min(slowest, Math.max(quickest, away / F.shelterSpeed)),
      bow: (draw(salt) - 0.5) * 2,
    };
  });
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
 * Where every animal of a critter is at this moment, for a picture of so many frames standing `size` world units tall:
 * one hopping is `hop.ts`'s, one leaping `leap.ts`'s, and a flock's are here. A bird flying off comes out of its cover, climbs and flies away
 * down its own heading, flapping and then gliding, flapping again now and then, and then hooks: a sharp turn, fading
 * from it, and a drop of a little over a bird length straight down the screen, settling. A bird taking shelter flies
 * a bowed path from one crown to the other, rising and dropping, gliding at the top, and fades as it goes into the
 * leaves. Each comes out of its cover whole within a moment, so none of it ever appears or vanishes in the open.
 */
export function posesOf(event: CritterEvent, seconds: number, frames: number, size = 0.55): Pose[] {
  const poses: Pose[] = [];
  const crown = event.from.height * 0.75;
  for (const bird of event.animals) {
    const flown = seconds - event.startsAt - bird.delay;
    const share = flown / bird.seconds;
    if (share <= 0 || share >= 1) continue;
    if (event.behaviour === 'hop') {
      poses.push(hopPose(event.kind, event.from, bird, flown, frames));
      continue;
    }
    if (event.behaviour === 'leap') {
      poses.push(leapPose(event.from, bird, flown, frames));
      continue;
    }
    const beat = Math.floor((flown + bird.phase) * F.flapsPerSecond);
    const out = ramp(0, F.fadeIn * F.seconds, flown);
    if (bird.to !== null) {
      poses.push(shelterPose(event.from, bird, share, crown, out, beat, frames));
      continue;
    }
    // Whole until it hooks, and fading from the turn until it is gone.
    const alpha = Math.min(out, ramp(1, F.hookAt, share));
    if (share > F.hookAt) {
      poses.push(hookPose(event.from, bird, share, crown, alpha, beat, frames, size));
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
      alpha,
    });
  }
  return poses;
}

/** The rings on the water a critter leaves at this moment: a leaping fish's, and nothing of any other. */
export function ringsOf(event: CritterEvent, seconds: number): Ring[] {
  if (event.behaviour !== 'leap') return [];
  return event.animals.flatMap((animal) =>
    leapRings(event.from, animal, seconds - event.startsAt - animal.delay),
  );
}

/**
 * A bird flying off, past where it hooks: on along its heading for a moment, braking into the turn, and then straight
 * down the screen, which is down in height, since what flies stands up the screen as the scenery does, so the turn is
 * the same whichever way the camera is turned.
 */
function hookPose(
  from: Cover,
  bird: Animal,
  share: number,
  crown: number,
  alpha: number,
  beat: number,
  frames: number,
  size: number,
): Pose {
  const at = F.hookAt;
  const k = (share - at) / (1 - at);
  const along = F.reach * bird.reach * at ** 0.85 + F.hookTurn * size * (1 - (1 - Math.min(1, k / 0.3)) ** 2);
  const high = crown + F.climb * Math.sin((at * Math.PI) / 2);
  return {
    x: from.x + Math.cos(bird.heading) * along,
    y: from.y + Math.sin(bird.heading) * along,
    height: high - F.hookDrop * size * ramp(0.1, 1, k) ** 1.4,
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

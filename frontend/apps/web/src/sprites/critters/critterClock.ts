import { FROGS, memberFrom, memberOf, openOf } from './casts';
import type { CastMember } from './casts';
import { FLUSH_LONGEST, flockOf, flushPose } from './flush';
import { HOP_LONGEST, hopPose, hopRings, hopper, waterNear } from './hop';
import { LEAP_LONGEST, leapPose, leapRings, leapersOf } from './leap';
import { CRITTERS_LOOK } from './look';
import { SLITHER_LONGEST, slitherPose, slitherer } from './slither';
import { SOAR_LONGEST, soarPose, soarersOf } from './soar';
import type { Animal, Cover, CritterEvent, Ground, Pose, Ring } from './types';

export type { Animal, Cover, CritterEvent, Ground, Pose, Ring } from './types';

/**
 * When and where the critters are: a pure function of the place and the wall clock, so nothing about them is
 * remembered or sent and every browser works out the same ones at the same moment, as every browser draws the same
 * sky. The ground is cut into cells and the clock into slots; a hash of a cell and a slot says whether anything comes
 * there then, out of which piece of the scenery standing in the cell, which of that ground's cast, when in the slot,
 * and everything about how it goes: a flock bursting out of cover, `flush.ts`, a small animal hopping to the next piece of
 * cover, `hop.ts`, a snake gliding to the next tuft, `slither.ts`, a fish jumping out of the water, `leap.ts`, or a hawk
 * circling over open ground, `soar.ts`, the last two out of no scenery but the water or the ground at a place of the
 * cell drawn for them. Beside any lake or river a frog may come out of the reeds or the grass and hop into it. After that it is a function of the seconds since it began. See
 * docs/plans/living-world.md. A piece of the ruins of a town of 1790 brings out the ruins' own cast, whatever the
 * ground it stands on: crows bursting out of it or circling over it, a rat scurrying from it (`RUINS_CAST`).
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
const LONGEST = Math.max(FLUSH_LONGEST, HOP_LONGEST, LEAP_LONGEST, SOAR_LONGEST, SLITHER_LONGEST);

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
  // What comes out of no scenery - a fish, a hawk, a covey off a field - needs no cover: a place of the cell is drawn,
  // and as often as the water or the open ground there has one, by its weight in the cast, it comes out of it there.
  // Its own draw, so what comes out of cover, a ruin's crows among them, keeps every share it has of the rest.
  const at = { x: fromX + draw(20) * L.cell, y: fromY + draw(21) * L.cell };
  const open = ground.classAt(at.x, at.y);
  const opens = openOf(open);
  const free = draw(90) < opens.share ? memberOf(opens.members, draw(2)) : null;
  if (free !== null) {
    if (!ground.sees(at.x, at.y)) return null;
    const from = { ...at, kind: open!, height: 0 };
    const animals = openAnimals(free, from, draw);
    return animals.length === 0
      ? null
      : { key, kind: free.kind, behaviour: free.behaviour, startsAt, from, animals };
  }
  const cover = ground.coverIn(fromX, fromY, fromX + L.cell, fromY + L.cell);
  if (cover === null || cover.length === 0) return null;
  const sorted = [...cover].sort((one, other) => one.y - other.y || one.x - other.x);
  const from = sorted[Math.floor(critterHash(cellX, cellY, slot, 1) * sorted.length)]!;
  const shore = L.hop.frog?.water;
  const water = shore !== undefined && FROGS.from.includes(from.kind) ? waterNear(from, ground, shore) : null;
  const member = memberFrom(from.kind, ground.classAt(from.x, from.y), draw(2), water !== null);
  if (member === null || !member.from.includes(from.kind) || !ground.sees(from.x, from.y)) return null;
  if (member.behaviour === 'soar') {
    // Crows circling over the piece of the ruins they came to, a few together.
    return {
      key,
      kind: member.kind,
      behaviour: 'soar',
      startsAt,
      from,
      animals: soarersOf(member.kind, draw),
    };
  }
  if (member.behaviour === 'hop' || member.behaviour === 'slither') {
    // One animal bounding or gliding to cover near by, or a frog into the water beside it; with none near, nothing comes.
    const hops = member.behaviour === 'hop';
    const reach = hops ? (L.hop[member.kind]?.reach ?? [0, 0]) : L.slither.reach;
    const near = water !== null && member === FROGS ? [water] : coverNear(from, member.from, ground, reach);
    if (near === null) return null;
    const animal = hops ? hopper(member.kind, from, near, draw) : slitherer(from, near, draw);
    if (animal === null) return null;
    return { key, kind: member.kind, behaviour: member.behaviour, startsAt, from, animals: [animal] };
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
    animals: flockOf(from, near, flit, draw, L.kinds[member.kind]?.together),
  };
}

/**
 * The animals of a critter that comes out of the open ground or the water at a place, rather than out of cover: a fish
 * leaping, a bird circling, a flock bursting up off the ground with no tree near to take shelter in.
 */
export function openAnimals(member: CastMember, from: Cover, draw: (salt: number) => number): Animal[] {
  if (member.behaviour === 'leap') return leapersOf(member.kind, draw);
  if (member.behaviour === 'soar') return soarersOf(member.kind, draw);
  if (member.behaviour === 'flush') return flockOf(from, [], false, draw, L.kinds[member.kind]?.together);
  return [];
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

/**
 * Where every animal of a critter is at this moment, for a picture of so many frames standing `size` world units tall:
 * one of a flush is `flush.ts`'s, one hopping `hop.ts`'s, one leaping `leap.ts`'s, one soaring `soar.ts`'s and one
 * gliding `slither.ts`'s.
 */
export function posesOf(event: CritterEvent, seconds: number, frames: number, size = 0.55): Pose[] {
  const poses: Pose[] = [];
  for (const bird of event.animals) {
    const flown = seconds - event.startsAt - bird.delay;
    const share = flown / bird.seconds;
    if (share <= 0 || share >= 1) continue;
    if (event.behaviour === 'hop') {
      poses.push(hopPose(event.kind, event.from, bird, flown, frames));
      continue;
    }
    if (event.behaviour === 'leap') {
      poses.push(leapPose(event.kind, event.from, bird, flown, frames));
      continue;
    }
    if (event.behaviour === 'soar') {
      poses.push(soarPose(event.kind, event.from, bird, flown, frames));
      continue;
    }
    if (event.behaviour === 'slither') {
      poses.push(slitherPose(event.from, bird, flown, frames));
      continue;
    }
    poses.push(flushPose(event, bird, flown, frames, size));
  }
  return poses;
}

/** The rings on the water a critter leaves at this moment: a leap's or a blow's, a frog's gone in, and no other's. */
export function ringsOf(event: CritterEvent, seconds: number): Ring[] {
  if (event.behaviour !== 'leap' && event.behaviour !== 'hop') return [];
  return event.animals.flatMap((animal) => {
    const flown = seconds - event.startsAt - animal.delay;
    return event.behaviour === 'leap'
      ? leapRings(event.kind, event.from, animal, flown)
      : hopRings(animal, flown);
  });
}

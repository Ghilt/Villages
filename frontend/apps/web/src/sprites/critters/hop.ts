import { WATERS } from './casts';
import { ringAt } from './leap';
import { CRITTERS_LOOK } from './look';
import type { HopLook } from './look';
import type { Animal, Cover, Ground, Pose, Ring } from './types';

/**
 * The hop: a small animal bounding a few times from one piece of cover to another near it, and gone behind it - a
 * squirrel from tree to tree in the woods, a hare out from behind a bush or a tuft on grassland, a frog from one tuft of
 * the reeds to the next, a marmot from boulder to boulder, a lizard from stone to stone or over the open sand, an arctic
 * hare out of the tundra's heather or over the open snow - or a frog into the water beside it, leaving a ring where it
 * went in. It runs on the ground,
 * so it is drawn under the scenery and a tree in front of it hides it, and it fades as it comes out from behind its
 * cover and as it goes behind the next, or into the water, so it never appears or vanishes in the open. Part of the
 * critters' clock, `critterClock.ts`: a pure function of the draws its cell and slot give it, the same in every browser.
 */

const L = CRITTERS_LOOK;
/** How long the ring spreads after a frog has gone into the water, and how wide it grows against a fish's. */
const PLOP = L.leap.ring.seconds;
const PLOP_WIDE = 0.6;

/** Whether a hop ends in the water rather than behind a piece of cover: a frog's, into a lake or a river. */
const intoWater = (to: Cover): boolean => WATERS.includes(to.kind);

/** How long an animal is on its way: all of its hop but the ring spreading after a frog that went into the water. */
const hoppingOf = (animal: Animal): number => animal.seconds - (intoWater(animal.to!) ? PLOP : 0);

/**
 * The place of a lake or a river nearest a piece of cover, as near and as far as said, looked for every quarter of a
 * world unit out in eight ways round it; null with none so near, or while the ground there is not yet known.
 */
export function waterNear(
  from: Cover,
  ground: Ground,
  [least, most]: readonly [number, number],
): Cover | null {
  for (let away = least; away <= most + 1e-9; away += 0.25) {
    for (let way = 0; way < 8; way += 1) {
      const x = from.x + Math.cos((way * Math.PI) / 4) * away;
      const y = from.y + Math.sin((way * Math.PI) / 4) * away;
      const kind = ground.classAt(x, y);
      if (kind !== null && WATERS.includes(kind)) return { x, y, kind, height: 0 };
    }
  }
  return null;
}

/** How many bounds it takes to cover so much ground: never fewer than two, so it can stop once between them. */
function boundsFor(look: HopLook, away: number): number {
  return Math.max(2, Math.round(away / look.bound));
}

/**
 * The longest any hop lasts, with the ring after a frog that went into the water, so the slots before the current one
 * that may still be bounding are asked too.
 */
export const HOP_LONGEST = Math.max(
  0,
  ...Object.values(L.hop).map((look) =>
    look === undefined ? 0 : boundsFor(look, look.reach[1]) / look.boundsPerSecond + look.pause + PLOP,
  ),
);

/**
 * The one animal of a hop, bounding from its cover to one of the pieces near enough that `draw` picks, given nearest
 * first, or into the water a frog is given; null for a kind that does not hop, or with nowhere near to go.
 */
export function hopper(
  kind: string,
  from: Cover,
  near: readonly Cover[],
  draw: (salt: number) => number,
): Animal | null {
  const look = L.hop[kind];
  if (look === undefined || near.length === 0) return null;
  const to = near[Math.floor(draw(7) * near.length)]!;
  const away = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    heading: Math.atan2(to.y - from.y, to.x - from.x),
    delay: 0,
    reach: 1,
    phase: draw(8),
    to,
    seconds: boundsFor(look, away) / look.boundsPerSecond + look.pause + (intoWater(to) ? PLOP : 0),
    bow: (draw(9) - 0.5) * 2,
  };
}

/**
 * The one animal of a hop over the open ground, where nothing stands to run to - a lizard on the sand, an arctic hare
 * on the snow: to a place as near and as far as its kind bounds, a way the draw picks, on the same ground and where the
 * house sees; null where that is not so.
 */
export function openHopper(
  kind: string,
  from: Cover,
  draw: (salt: number) => number,
  ground: Ground,
): Animal | null {
  const look = L.hop[kind];
  if (look === undefined) return null;
  const away = look.reach[0] + (look.reach[1] - look.reach[0]) * draw(31);
  const way = draw(32) * Math.PI * 2;
  const to = {
    x: from.x + Math.cos(way) * away,
    y: from.y + Math.sin(way) * away,
    kind: from.kind,
    height: 0,
  };
  if (ground.classAt(to.x, to.y) !== from.kind || !ground.sees(to.x, to.y)) return null;
  return hopper(kind, from, [to], draw);
}

const ramp = (from: number, to: number, value: number): number =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

/**
 * Where a hopping animal is, `flown` seconds after it set off, for a strip of so many frames: bounding along a path
 * bowed a little to one side, high in the middle of every bound and on the ground between them, stopping once on the
 * way to sit still, and fading as it comes out from behind its cover and as it goes behind the next.
 */
export function hopPose(kind: string, from: Cover, animal: Animal, flown: number, frames: number): Pose {
  const look = L.hop[kind]!;
  const to = animal.to!;
  const hopping = hoppingOf(animal);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bounds = boundsFor(look, Math.hypot(dx, dy));
  const each = 1 / look.boundsPerSecond;
  // It stops after one of its bounds, never before the first nor after the last, which its phase picks.
  const stopsAt = (1 + Math.floor(animal.phase * (bounds - 1))) * each;
  const sitting = flown >= stopsAt && flown < stopsAt + look.pause;
  const moving = flown < stopsAt ? flown : sitting ? stopsAt : flown - look.pause;
  const done = Math.min(bounds, moving / each);
  // How far through the bound it is in: nought on the ground as it leaves, a half at the top, one landing.
  const through = sitting ? 0 : done - Math.min(bounds - 1, Math.floor(done));
  const along = done / bounds;
  const side = animal.bow * 0.1 * Math.sin(along * Math.PI);
  const { gathered, air, landing, still } = look.frames;
  const role = sitting ? still : through < 0.15 ? gathered : through > 0.85 ? landing : air;
  return {
    x: from.x + dx * along - dy * side,
    y: from.y + dy * along + dx * side,
    height: look.high * 4 * through * (1 - through),
    frame: Math.min(frames - 1, role),
    alpha: Math.min(
      ramp(0, look.fade ?? L.hopFade, flown),
      ramp(hopping, hopping - (look.fade ?? L.hopFade), flown),
    ),
  };
}

/** The ring a frog leaves where it went into the water, `flown` seconds after it set off; none for any other hop. */
export function hopRings(animal: Animal, flown: number): Ring[] {
  if (animal.to === null || !intoWater(animal.to)) return [];
  const ring = ringAt(animal.to, flown - hoppingOf(animal) + L.hopFade / 2, PLOP_WIDE);
  return ring === null ? [] : [ring];
}

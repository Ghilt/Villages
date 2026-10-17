import { CRITTERS_LOOK } from './look';
import type { HopLook } from './look';
import type { Animal, Cover, Pose } from './types';

/**
 * The hop: a small animal bounding a few times from one piece of cover to another near it, and gone behind it - a
 * squirrel from tree to tree in the woods, a hare out from behind a bush or a tuft on grassland. It runs on the ground,
 * so it is drawn under the scenery and a tree in front of it hides it, and it fades as it comes out from behind its
 * cover and as it goes behind the next, so it never appears or vanishes in the open. Part of the critters' clock,
 * `critterClock.ts`: a pure function of the draws its cell and slot give it, the same in every browser.
 */

const L = CRITTERS_LOOK;

/** How many bounds it takes to cover so much ground: never fewer than two, so it can stop once between them. */
function boundsFor(look: HopLook, away: number): number {
  return Math.max(2, Math.round(away / look.bound));
}

/** The longest any hop lasts, so the slots before the current one that may still be bounding are asked too. */
export const HOP_LONGEST = Math.max(
  0,
  ...Object.values(L.hop).map((look) =>
    look === undefined ? 0 : boundsFor(look, look.reach[1]) / look.boundsPerSecond + look.pause,
  ),
);

/**
 * The one animal of a hop, bounding from its cover to one of the pieces near enough that `draw` picks, given nearest
 * first; null for a kind that does not hop, or with nowhere near to go.
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
    seconds: boundsFor(look, away) / look.boundsPerSecond + look.pause,
    bow: (draw(9) - 0.5) * 2,
  };
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
    alpha: Math.min(ramp(0, L.hopFade, flown), ramp(animal.seconds, animal.seconds - L.hopFade, flown)),
  };
}

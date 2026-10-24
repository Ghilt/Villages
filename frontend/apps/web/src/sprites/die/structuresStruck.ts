import { untiltGround } from '../../geometry/cameraMath';
import type { GroundTilt, MercatorPoint } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import type { StandingThing } from '../standing/StandingLayer';
import type { Nudge } from './physics';

/**
 * The structures a die let go is blown off: a die low over the ground a structure's picture covers, its middle there
 * or touching it, is struck by a pulse from the middle of the structure's base, as a little explosion would, and sent
 * away from it fast enough to roll clear, with a hop - while it still moves, so it never comes to rest on a building.
 * Again if it is still on one a moment after, a few times at most. In the ground's units from where the arc ends, a
 * unit `unitWide` world units. Trees are left out, so a wood never stops a throw short. Adam's word of 2026-10-24,
 * after boxes and a cone for the physics to strike either let the die lie on a castle's roof or looked strange.
 */

/** How long after one pulse another may come, in seconds, and the most one throw is given. */
const AGAIN_AFTER = 0.3;
const MOST = 6;
/** How far past a picture's edge the die's middle still counts as on it: half its width, the die touching it. */
const TOUCHING = 0.5;
/**
 * How a pulse sends it: up in a hop a quarter of its width high, and on far enough in the hop and the slide after it
 * to be a little past clear, in its widths - gently, a nudge rather than a blast, and again if it was not enough.
 * Worked out from the gravity on the ground, which is weak in die widths close in, where the die is drawn big: a hop
 * of a fixed speed there hung in the air for seconds and carried the die off the screen. Adam's "much smaller force"
 * of 2026-10-24.
 */
const HOP = 0.25;
const PAST = 0.25;
/** How long a die sliding over the ground takes to lose most of its speed, in seconds: the ground drag's. */
const SLIDES_FOR = 0.17;
/** How low the die must be for a pulse to strike it, in its widths: on the ground or bouncing near it. */
const LOW = 1.2;
/** How far from where the arc ends a structure is looked at, in the ground's units: a long roll's worth. */
const REACH = 60;

/** What of a thing standing a pulse is made from: where its foot is, how it hangs from it, and how big it is drawn. */
export type Pictured = Pick<StandingThing, 'place' | 'anchor' | 'tall' | 'wide' | 'shown'>;

/** The ground a picture covers, as far as the die counts it on it, and where its pulse comes from. */
interface Zone {
  readonly west: number;
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly from: { readonly x: number; readonly y: number };
}

export interface Pulses {
  readonly nudge: Nudge;
  /** How many structures were near enough to be on. */
  readonly near: number;
  /** How many pulses struck the die. */
  fired(): number;
}

export function pulsesAround(
  standing: readonly Pictured[],
  struck: MercatorPoint,
  unitWide: number,
  tilt: GroundTilt,
  gravity: number,
): Pulses {
  const at = { x: struck.x * WORLD_MASTER_WIDTH, y: struck.y * WORLD_MASTER_WIDTH };
  const zones: Zone[] = [];
  for (const thing of standing) {
    if (!thing.shown || thing.wide <= 0 || thing.tall <= 0) continue;
    // On the screen, in world units from its foot, laid back down on the ground in the die's units.
    const onTheGround = (x: number, y: number) => {
      const ground = untiltGround(x, y, tilt);
      return {
        x: (thing.place.x - at.x + ground.east) / unitWide,
        y: (thing.place.y - at.y + ground.south) / unitWide,
      };
    };
    const left = -thing.anchor * thing.wide;
    const right = (1 - thing.anchor) * thing.wide;
    const corners = [
      onTheGround(left, 0),
      onTheGround(right, 0),
      onTheGround(left, -thing.tall),
      onTheGround(right, -thing.tall),
    ];
    const zone = {
      west: Math.min(...corners.map((one) => one.x)) - TOUCHING,
      east: Math.max(...corners.map((one) => one.x)) + TOUCHING,
      north: Math.min(...corners.map((one) => one.y)) - TOUCHING,
      south: Math.max(...corners.map((one) => one.y)) + TOUCHING,
      from: onTheGround((left + right) / 2, 0),
    };
    if (Math.hypot(Math.max(zone.west, 0, -zone.east), Math.max(zone.north, 0, -zone.south)) > REACH)
      continue;
    zones.push(zone);
  }

  let fired = 0;
  let last = -Infinity;
  const up = Math.sqrt(2 * gravity * HOP);
  const aloft = (2 * up) / gravity;
  const nudge: Nudge = (die, _velocity, seconds) => {
    if (fired >= MOST || seconds - last < AGAIN_AFTER || die.z > LOW) return null;
    const on = zones.find((zone) => inside(zone, die.x, die.y));
    if (on === undefined) return null;
    // Away from the middle of its base, and straight south, the way out in front of it, from right over it.
    const east = die.x - on.from.x;
    const south = die.y - on.from.y;
    const apart = Math.hypot(east, south);
    const way = apart < 1e-6 ? { x: 0, y: 1 } : { x: east / apart, y: south / apart };
    const speed = (clearIn(on, die.x, die.y, way) + PAST) / (aloft + SLIDES_FOR);
    fired += 1;
    last = seconds;
    return { x: way.x * speed, y: way.y * speed, z: up };
  };
  return { nudge, near: zones.length, fired: () => fired };
}

function inside(zone: Zone, x: number, y: number): boolean {
  return x > zone.west && x < zone.east && y > zone.north && y < zone.south;
}

/** How far the die has to go `way` from (x, y) to be out of the zone. */
function clearIn(zone: Zone, x: number, y: number, way: { x: number; y: number }): number {
  const across = way.x > 0 ? (zone.east - x) / way.x : way.x < 0 ? (zone.west - x) / way.x : Infinity;
  const along = way.y > 0 ? (zone.south - y) / way.y : way.y < 0 ? (zone.north - y) / way.y : Infinity;
  return Math.min(across, along);
}

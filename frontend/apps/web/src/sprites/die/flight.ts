import { about, multiply, normalised } from './physics';
import type { DieFeel, Quat, Vec3 } from './physics';

/**
 * The die's flight from the hand to the ground: one continuous arc, as a flick near the ground would make, scaled up.
 * The hand holds the die near the eye, high above the map, so a throw from there carries a long way before it comes
 * down, and the harder the flick the further: it rises, sails and falls in one arc, growing a little as it rises and
 * shrinking to its size on the ground as it falls. Where the arc ends, it strikes the ground, and the bounce and the
 * roll are the physics' (`physics.ts`), at the ground's own scale. A drop is the same arc with no length. Adam's word of
 * 2026-10-22: "it should travel vast distances before even starting to fall, it should be a continuous arc. just
 * scaled up, as with a flick from near the ground". See `docs/plans/choice-roll-podium.md`, *The physics*.
 */

/** How a throw flies: the numbers the spike page puts on sliders. */
export interface FlightFeel {
  /** How far a throw carries for the speed of the flick: so many seconds of it, the flick's speed in pixels a second. */
  readonly carries: number;
  /** The furthest a throw carries, in pixels on the screen as it is let go. */
  readonly farthest: number;
  /** How high the arc rises over its middle, as a share of how far it carries. */
  readonly arcs: number;
  /** How long a drop is in the air, in seconds; a throw is longer as the square root of how much further it goes. */
  readonly fallsIn: number;
  /** How much it grows as it first rises, before it shrinks as it falls: nought for none. */
  readonly grows: number;
  /**
   * How much it slows over the ground as it nears it, as a thing thrown away from the eye does: one for not at all.
   * It shrinks the same way, quickly as it leaves the hand and steadily as it comes down.
   */
  readonly slows: number;
  /** How flat it comes down at the end of its arc: one for straight down its line, more for a longer, gentler fall. */
  readonly landsFlat: number;
  /**
   * How much of its mean speed over the ground it still has as it strikes it, to bounce and roll on with: so it slows
   * as it comes down but never to a stop, and a mark far out is still going somewhere as it lands.
   */
  readonly rollsOn: number;
  /** The fastest it goes on along the ground as it strikes it, in pixels a second: a hard throw lands as a meek one does. */
  readonly rollsAtMost: number;
  /**
   * How hard it strikes the ground, as though it had fallen this share of the height its arc rose from: so a throw from
   * high up, a long arc, comes down hard and bounces big, and a drop only hops.
   */
  readonly strikesFrom: number;
  /**
   * The highest it strikes the ground as though from, in pixels, before it is made harder from high up: so a hard throw
   * bounces as a meek one does, a little more, and not as high again as its arc. Adam's word at the spike: "if i do a
   * really meek throw now it looks exactly like i want it. But as soon as i throw harder it bounces way too much".
   */
  readonly strikesAtMost: number;
  /**
   * How much harder again it strikes the higher it was thrown from: so much more of its arc for every halving of its size
   * between the hand and the ground. So a throw from far out, where it falls to a mark, bounces big once or twice, and
   * one close in, where it lands nearly as big as it was held, bounces as a die on a table does.
   */
  readonly fromHigh: number;
  /** How fast it falls faster on the ground, in pixels a second every second: as floaty as its flight looks. */
  readonly pulls: number;
}

export const FLIGHT: FlightFeel = {
  carries: 0.55,
  farthest: 1500,
  arcs: 0.3,
  fallsIn: 1,
  grows: 1,
  slows: 1.5,
  landsFlat: 2,
  rollsOn: 0.45,
  rollsAtMost: 90,
  strikesFrom: 0.3,
  strikesAtMost: 50,
  fromHigh: 0.5,
  pulls: 400,
};

/** How much longer a throw is in the air than a drop, for every so many pixels it carries: a flick's arc, scaled up. */
const SCALES_EVERY = 120;
/** The share of its flight a die grows over before it shrinks. */
const RISES_FOR = 0.3;

/** A flight worked out as the die is let go. */
export interface Flight {
  /** Where it strikes the ground, in die widths from the ground point it was let go over: east and south. */
  readonly to: { readonly x: number; readonly y: number };
  /** How far that is, in pixels on the screen as it was let go. */
  readonly pixels: number;
  readonly seconds: number;
  /** Its tumble, in radians a second about the axis it turns on. */
  readonly spin: Vec3;
  /** How it was turned as it was let go. */
  readonly turn: Quat;
  /** How much it slows over the ground as it comes down: the feel's, as it was let go. */
  readonly slows: number;
  /** How much of its mean speed over the ground it keeps as it strikes it: the feel's, or less for a hard throw. */
  readonly rollsOn: number;
}

/**
 * The flight of a die let go over a point of the ground, `distance` pixels on the screen toward `way` (radians, east
 * nought, south a quarter turn), a die width being `diePixels` on the ground there. Nought pixels is a drop.
 */
export function flightOf(
  distance: number,
  way: number,
  diePixels: number,
  turn: Quat,
  feel: FlightFeel,
): Flight {
  const pixels = Math.min(distance, feel.farthest);
  const along = pixels / diePixels;
  const seconds = feel.fallsIn * Math.sqrt(1 + pixels / SCALES_EVERY);
  // Tumbling forward, over the way it goes, and faster the further; a drop only turns a little in the hand.
  const forward = { x: -Math.sin(way), y: Math.cos(way), z: 0 };
  const tumble = pixels > 0 ? 7 + pixels / 90 : 2.5;
  const mean = pixels / seconds;
  return {
    to: { x: Math.cos(way) * along, y: Math.sin(way) * along },
    pixels,
    seconds,
    spin:
      pixels > 0
        ? { x: forward.x * tumble, y: forward.y * tumble, z: 1.2 }
        : { x: tumble, y: -tumble * 0.6, z: 0.8 },
    turn,
    slows: feel.slows,
    rollsOn: mean > 0 ? Math.min(feel.rollsOn, feel.rollsAtMost / mean) : feel.rollsOn,
  };
}

/** Where the die is so far into its flight: its ground point in die widths, the share of the flight flown, its turn. */
export function flownAt(
  flight: Flight,
  seconds: number,
): { x: number; y: number; flown: number; turn: Quat } {
  const flown = Math.min(1, Math.max(0, seconds / flight.seconds));
  const t = flown * flight.seconds;
  const rate = Math.hypot(flight.spin.x, flight.spin.y, flight.spin.z);
  const turn = rate === 0 ? flight.turn : normalised(multiply(about(flight.spin, rate * t), flight.turn));
  // Quickly over the ground as it leaves the hand, and slower and steadier as it comes down to it, but still going as it
  // strikes it: as fast as it rolls on with, so the flight and the bounce are one motion.
  const eased = 1 - (1 - flown) ** flight.slows;
  const over = flight.rollsOn * flown + (1 - flight.rollsOn) * eased;
  return { x: flight.to.x * over, y: flight.to.y * over, flown, turn };
}

/**
 * How wide the die is drawn so far into its flight, in pixels: the size of a hand as it is let go, growing a little as
 * it first rises, then shrinking to `landed`, its size on the ground, quickly as it leaves the hand and steadily as it
 * comes down, as a thing thrown away from the eye does.
 */
export function flyingSize(flown: number, hand: number, landed: number, feel: FlightFeel): number {
  const away = landed + (hand - landed) * (1 - flown) ** feel.slows;
  const rising = Math.sin(Math.PI * Math.min(1, flown / RISES_FOR));
  return away * (1 + feel.grows * 0.35 * rising);
}

/**
 * How far above its ground point the die's middle is drawn so far into its flight, in pixels: where it was held, `hang`
 * over its shadow, rising early as high again as its share of how far it carries, and a little for a drop, which is
 * tossed as it is let go, then coming down in a long, steady fall, flatter at the end the more it `landsFlat`.
 */
export function flyingLift(flown: number, hang: number, pixels: number, feel: FlightFeel): number {
  const rise = feel.arcs * pixels + hang * 0.6;
  const highest = 1 / (1 + feel.landsFlat);
  const peak = highest * (1 - highest) ** feel.landsFlat;
  return (1 - flown) ** feel.landsFlat * (hang + (rise * flown) / peak);
}

/** How the die starts on the ground as it strikes it at the end of its flight: what the physics takes on. */
export interface Landing {
  /** In ground units a second, a ground unit being `unit` pixels: east, south and up. */
  readonly velocity: Vec3;
  readonly spin: Vec3;
  /** Gravity on the ground, in ground units a second every second. */
  readonly gravity: number;
}

/**
 * How the die strikes the ground at the end of its flight, worked out on the screen's own scale, `unit` pixels to a
 * unit, as wide as the die is drawn there: going on the way it flew, as fast as it was going as it struck; down into
 * the ground as hard as though it had fallen a share of the height its arc rose from, `hang` pixels over its shadow
 * where it was held, and harder the more times smaller it `shrank` between the hand and the ground; rolling forward as
 * hard as the physics' spin says; and falling faster at the flight's own pace. So a mark far out lands still sliding
 * and bounces big where the eye can see it, and a die close in lands as a die on a table does. Adam's word of
 * 2026-10-22: "some sideways travel left as it is a mark. maybe a big bounce or two if thrown from a great height".
 * See docs/plans/choice-roll-podium.md, *The flight*.
 */
export function landingOf(
  flight: Flight,
  feel: FlightFeel,
  ground: DieFeel,
  hang: number,
  unit: number,
  shrank: number,
): Landing {
  const along = Math.hypot(flight.to.x, flight.to.y);
  const way = along === 0 ? { x: 0, y: 0 } : { x: flight.to.x / along, y: flight.to.y / along };
  const rise = feel.arcs * flight.pixels + hang * 0.6;
  const high = 1 + feel.fromHigh * Math.max(0, Math.log2(shrank));
  const from = Math.min(feel.strikesFrom * (hang + rise), feel.strikesAtMost) * high;
  const down = Math.sqrt(2 * feel.pulls * from) / unit;
  const speed = ((flight.pixels / flight.seconds) * flight.rollsOn) / unit;
  const rolls = speed * ground.spin * 2;
  return {
    velocity: { x: way.x * speed, y: way.y * speed, z: -down },
    spin: { x: -way.y * rolls, y: way.x * rolls, z: flight.spin.z },
    gravity: feel.pulls / unit,
  };
}

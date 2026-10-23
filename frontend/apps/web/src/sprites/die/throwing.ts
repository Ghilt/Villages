import type { Graphics } from 'pixi.js';

import {
  fromMercator,
  groundTilt,
  pixelsPerWorldUnit,
  untiltGround,
  worldSize,
} from '../../geometry/cameraMath';
import type { CameraView, MercatorPoint, ScreenPoint } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { aMarkInTheAir, asAPin, asItLies, inTheHandLift, onTheGroundLift, seenAt } from './dieDrawing';
import type { DieDrawing, DieLook, Dust } from './dieDrawing';
import { FLIGHT, asADie, flightOf, flownAt, flyingLift, flyingSize, landingOf } from './flight';
import type { Flight, FlightFeel } from './flight';
import { isThrow } from './gesture';
import { mercatorOf, screenOf } from './onTheGround';
import { FEEL, throwDie } from './physics';
import type { DieFeel, Obstacle, Quat, ThrowPath } from './physics';
import { LAYOUT, layoutShowing } from './pips';
import { between, heldTurn, squashAt } from './playback';
import { drawLandingCircle } from './ring';

/**
 * The die held, let go and played back, on any canvas over the map: the spike's page draws it on one of its own and
 * the game on its sprite canvas. Worked out whole the moment it is let go - the flight's arc, then the physics' bounce -
 * and played back pinned to the ground by the camera's arithmetic, so it flies over the same ground whatever the camera
 * does meanwhile. See `docs/plans/choice-roll-podium.md`, *The physics*.
 */

export interface DieSettings {
  readonly feel: DieFeel;
  readonly flight: FlightFeel;
  readonly look: DieLook;
  readonly juice: boolean;
  readonly striking: boolean;
  /** The number the game wants on top, or null for whatever the throw leaves there. */
  readonly showing: number | null;
  readonly circleKm: number;
  /** How fast a hand must be moving as it lets go to throw the die rather than drop it, in pixels a second. */
  readonly throwsFrom: number;
}

/** The die as Adam settled it at the spike, on 2026-10-22 and 23. */
export const DIE_SETTINGS: DieSettings = {
  feel: FEEL,
  flight: FLIGHT,
  look: { size: 44, landedWide: 2, hang: 56, ownAngle: 35 },
  juice: true,
  striking: false,
  showing: null,
  circleKm: 25,
  throwsFrom: 300,
};

/** Where a die came to rest and how it got there. */
export interface Rested {
  readonly how: 'dropped' | 'thrown';
  readonly lat: number;
  readonly lon: number;
  readonly away: number;
  readonly flew: number;
  readonly speed: number;
  readonly seconds: number;
  readonly steps: number;
  readonly workedOutMs: number;
  readonly came: number;
  readonly settled: boolean;
}

/** A die let go: its flight, its path on the ground, and where both are pinned. */
export interface Thrown {
  readonly flight: Flight;
  readonly path: ThrowPath;
  readonly numbers: readonly number[];
  readonly anchor: MercatorPoint;
  readonly perDie: number;
  /** How wide a die width was on the screen as it was let go, which the arc's height was measured against. */
  readonly landedThen: number;
  /** Where the arc ended, and how much of the Mercator square one of the ground's units is: the bounce's scale. */
  readonly struck: MercatorPoint;
  readonly perUnit: number;
  readonly since: number;
  readonly rested: Rested;
}

/** What a die is drawn with: its own drawing, the dust it raises, and the ring round it. */
export interface DieParts {
  readonly die: DieDrawing;
  readonly dust: Dust;
  readonly ring: Graphics;
}

/** How far above the fingertip the shadow of a die held by a finger lies, so the finger never covers what aims it. */
const ABOVE_FINGER = 48;

/** How wide the die lies on the ground at this zoom, in pixels: its width in world units, at the ground's scale. */
export function landedAt(look: DieLook, zoom: number): number {
  return look.landedWide * pixelsPerWorldUnit(zoom);
}

/**
 * Where the shadow of a held die lies on the screen. Under a mouse the die hangs under the pointer and its shadow below
 * it; under a finger the shadow lies a little above the fingertip and the die above that, so the finger never covers
 * the shadow that aims the drop.
 */
export function heldGround(
  at: ScreenPoint,
  byTouch: boolean,
  chosen: DieSettings,
  pitch: number,
): ScreenPoint {
  if (byTouch) return { x: at.x, y: at.y - ABOVE_FINGER };
  return { x: at.x, y: at.y + inTheHandLift(chosen.look, pitch) };
}

/** Draws a die held in the hand, its shadow on the ground at `ground`, and the landing circle round it. */
export function drawHeld(
  parts: DieParts,
  ground: ScreenPoint,
  since: number,
  view: CameraView,
  chosen: DieSettings,
  t: number,
): void {
  const pitch = view.pitch ?? 0;
  const held = { at: { x: 0, y: 0, z: 0.5 }, turn: heldTurn(since, t) };
  const landed = landedAt(chosen.look, view.zoom);
  parts.die.draw(
    ground,
    held,
    LAYOUT,
    pitch,
    chosen.look,
    0,
    chosen.look.size,
    landed,
    inTheHandLift(chosen.look, pitch),
  );
  drawLandingCircle(parts.ring, ground, view, mercatorOf(ground, view), chosen.circleKm, t, 0);
}

/**
 * Lets go of a die whose shadow lies at `ground`, the hand moving at `speed` pixels a second and the die turned
 * `turn`: a drop when the hand was all but still, a throw when it was not. The whole of it is worked out here.
 */
export function letGo(
  ground: ScreenPoint,
  speed: { x: number; y: number },
  turn: Quat,
  view: CameraView,
  chosen: DieSettings,
  obstaclesAt: (struck: MercatorPoint, dieWide: number) => Obstacle[],
  t: number,
): Thrown {
  // The die's physics is in die widths, and a die width is its width lying on the ground: a world-sized thing, so a
  // throw rolls over the same ground at every zoom, and its flight carries as far on the screen as the flick was hard.
  const landed = landedAt(chosen.look, view.zoom);
  const anchor = mercatorOf(ground, view);
  const perDie = chosen.look.landedWide / WORLD_MASTER_WIDTH;
  const thrown = isThrow(speed, chosen.throwsFrom);
  const across = untiltGround(speed.x, speed.y, groundTilt(view));
  const distance = thrown ? Math.hypot(across.east, across.south) * chosen.flight.carries : 0;
  // A pin far out lands by the screen's pixels, and a die close in by its own widths: the flight's last stretch too,
  // so it strikes going as fast as it goes on.
  const feel = asAPin(landed, view.zoom) ? chosen.flight : asADie(chosen.flight, landed);
  const flight = flightOf(distance, Math.atan2(across.south, across.east), landed, turn, feel);
  const end = flownAt(flight, flight.seconds);
  // Where the arc ends, and the ground's unit there: as wide as the die is drawn, a pin's width far out.
  const struck = { x: anchor.x + end.x * perDie, y: anchor.y + end.y * perDie };
  const unit = asItLies(landed, view.zoom);
  const perUnit = unit / worldSize(view.zoom);
  // How far it fell, as how many times smaller it lies on the ground than it was in the hand: a mark far out fell far.
  const shrank = chosen.look.size / landed;
  const landing = landingOf(flight, feel, chosen.feel, chosen.look.hang, unit, shrank);
  const obstacles = chosen.striking ? obstaclesAt(struck, unit / pixelsPerWorldUnit(view.zoom)) : [];
  const begun = performance.now();
  const path = throwDie(
    { at: { x: 0, y: 0, z: 0.55 }, velocity: landing.velocity, spin: landing.spin, turn: end.turn },
    { ...chosen.feel, gravity: landing.gravity },
    obstacles,
  );
  const workedOutMs = performance.now() - begun;
  const numbers = chosen.showing === null ? LAYOUT : layoutShowing(path.up, chosen.showing);
  const last = path.frames[path.frames.length - 1]!;
  const rest = { x: struck.x + last.at.x * perUnit, y: struck.y + last.at.y * perUnit };
  const place = fromMercator(rest);
  return {
    flight,
    path,
    numbers,
    anchor,
    perDie,
    landedThen: landed,
    struck,
    perUnit,
    since: t,
    rested: {
      how: thrown ? 'thrown' : 'dropped',
      lat: place.lat,
      lon: place.lng,
      away: Math.hypot(rest.x - anchor.x, rest.y - anchor.y) * worldSize(view.zoom),
      flew: flight.pixels,
      speed: Math.hypot(speed.x, speed.y),
      seconds: flight.seconds + path.frames.length * path.every,
      steps: path.steps,
      workedOutMs,
      came: numbers[path.up]!,
      settled: path.settled,
    },
  };
}

/**
 * Draws a die that has been let go, at `t`: in its flight, or on the ground once it has struck it, raising dust at
 * each knock after `knocked` and saying how many it has raised. Whether it has come to rest, too.
 */
export function drawThrown(
  parts: DieParts,
  thrown: Thrown,
  view: CameraView,
  chosen: DieSettings,
  t: number,
  knocked: number,
): { done: boolean; knocked: number } {
  const { die, dust, ring } = parts;
  const pitch = view.pitch ?? 0;
  const seconds = (t - thrown.since) / 1000;
  const landed = landedAt(chosen.look, view.zoom);
  const on = (x: number, y: number) => ({
    x: thrown.anchor.x + x * thrown.perDie,
    y: thrown.anchor.y + y * thrown.perDie,
  });
  if (seconds < thrown.flight.seconds) {
    const flown = flownAt(thrown.flight, seconds);
    const place = on(flown.x, flown.y);
    const ground = screenOf(place, view);
    const size = flyingSize(flown.flown, chosen.look.size, landed, chosen.flight);
    // The arc as high as it was planned, at the ground's scale now, so it grows and shrinks with a zoom in its flight.
    const pixels = thrown.flight.pixels * (landed / thrown.landedThen);
    const rise = flyingLift(flown.flown, chosen.look.hang, pixels, chosen.flight);
    if (aMarkInTheAir(size, view.zoom, chosen.flight.marksBelow)) {
      // Shrunk to almost nothing far out: the pin falls the last of the arc, and lands.
      die.drawPin(ground, thrown.rested.came, rise);
    } else {
      const lift = 0.5 * Math.sin(seenAt(chosen.look, pitch)) * size + rise;
      const state = { at: { x: flown.x, y: flown.y, z: 0.5 }, turn: flown.turn };
      die.draw(ground, state, thrown.numbers, pitch, chosen.look, 0, size, landed, lift);
    }
    drawLandingCircle(ring, ground, view, place, chosen.circleKm, t, 0);
    return { done: false, knocked };
  }
  const onGround = seconds - thrown.flight.seconds;
  const { state, done } = between(thrown.path, onGround);
  // On the ground the die bounces and rolls on the screen's own scale, a unit as wide as it is drawn there (0.5 is
  // half of one): so a mark far out bounces where the eye can see it. See `landingOf`.
  const bounced = (x: number, y: number) => ({
    x: thrown.struck.x + x * thrown.perUnit,
    y: thrown.struck.y + y * thrown.perUnit,
  });
  const unit = thrown.perUnit * worldSize(view.zoom);
  const place = bounced(state.at.x, state.at.y);
  const ground = screenOf(place, view);
  let raised = knocked;
  if (chosen.juice) {
    while (raised < thrown.path.knocks.length && thrown.path.knocks[raised]!.time <= onGround) {
      const knock = thrown.path.knocks[raised]!;
      raised += 1;
      if (knock.speed > 6 && knock.at.z < 0.2) {
        // As big as the die is where it strikes, so a far-off die raises a little dust.
        dust.burst(
          screenOf(bounced(knock.at.x, knock.at.y), view),
          (knock.speed / 30) * Math.min(1, unit / 32),
          t,
        );
      }
    }
  }
  if (asAPin(landed, view.zoom)) {
    const hop = onTheGroundLift(Math.max(0, state.at.z - 0.5), unit, chosen.look, pitch);
    die.drawPin(ground, thrown.rested.came, hop);
  } else {
    const squash = chosen.juice ? squashAt(thrown.path.knocks, onGround) : 0;
    const lift = onTheGroundLift(state.at.z, unit, chosen.look, pitch);
    die.draw(ground, state, thrown.numbers, pitch, chosen.look, squash, landed, landed, lift);
  }
  const restedFor = done ? onGround - thrown.path.frames.length * thrown.path.every : -1;
  const flash = chosen.juice && restedFor > 0 ? 0.9 * Math.exp(-((restedFor - 0.35) ** 2) / 0.02) : 0;
  drawLandingCircle(ring, ground, view, place, chosen.circleKm, t, flash);
  return { done, knocked: raised };
}

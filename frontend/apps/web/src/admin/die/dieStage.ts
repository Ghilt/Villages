import { Application, Graphics } from 'pixi.js';
import type * as maplibregl from 'maplibre-gl';

import {
  fromMercator,
  groundTilt,
  pixelsPerWorldUnit,
  untiltGround,
  worldSize,
} from '../../geometry/cameraMath';
import type { CameraView, MercatorPoint, ScreenPoint } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import {
  aMarkInTheAir,
  asAPin,
  asItLies,
  createDieDrawing,
  createDust,
  inTheHandLift,
  onTheGroundLift,
  seenAt,
} from '../../sprites/die/dieDrawing';
import type { DieLook } from '../../sprites/die/dieDrawing';
import { flightOf, flownAt, flyingLift, flyingSize, landingOf } from '../../sprites/die/flight';
import type { Flight, FlightFeel } from '../../sprites/die/flight';
import { isThrow, kept, speedAtRelease } from '../../sprites/die/gesture';
import type { Sample } from '../../sprites/die/gesture';
import { throwDie } from '../../sprites/die/physics';
import type { DieFeel, Obstacle, Quat, ThrowPath } from '../../sprites/die/physics';
import { between, heldTurn, squashAt } from '../../sprites/die/playback';
import { LAYOUT, layoutShowing } from '../../sprites/die/pips';

import { mercatorOf, screenOf, viewOf } from './onTheMap';
import { drawLandingCircle } from './ring';
import { drawStandIns, standInsAround, standInsInDieWidths } from './standIns';
import type { StandIns } from './standIns';

/**
 * The spike's stage: a Pixi canvas over the map, where the die is held, let go, flown along its arc and played back on
 * the ground, pinned to it, with the landing circle round it and the stand-ins it can strike. Only the spike's: the game
 * draws the die as a layer of its own sprite canvas, a later step of `docs/plans/choice-roll-podium.md`.
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

/** Where a die came to rest and how it got there, for the page's readout. */
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

export interface DieStage {
  pickUp(at: ScreenPoint, byTouch: boolean, now: number): void;
  move(at: ScreenPoint, now: number): void;
  letGo(now: number): void;
  putBack(): void;
  /** Drops the die at the middle of the view, the way with no hand at all. */
  dropAtCentre(now: number): void;
  /** Stands the wood and the houses the die can strike round the middle of the view. */
  plant(): void;
  stop(): void;
}

/** How far above the fingertip the shadow of a die held by a finger lies, so the finger never covers what aims it. */
const ABOVE_FINGER = 48;

type Held = {
  readonly kind: 'held';
  at: ScreenPoint;
  readonly byTouch: boolean;
  readonly since: number;
  samples: Sample[];
};
interface Thrown {
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
type Now =
  | { readonly kind: 'idle' }
  | Held
  | ({ readonly kind: 'flying' } & Thrown)
  | ({ readonly kind: 'resting' } & Thrown);

/**
 * Where the shadow of a held die lies on the screen. Under a mouse the die hangs under the pointer and its shadow below
 * it; under a finger the shadow lies a little above the fingertip and the die above that, so the finger never covers
 * the shadow that aims the drop.
 */
function heldGround(at: ScreenPoint, byTouch: boolean, chosen: DieSettings, pitch: number): ScreenPoint {
  if (byTouch) return { x: at.x, y: at.y - ABOVE_FINGER };
  return { x: at.x, y: at.y + inTheHandLift(chosen.look, pitch) };
}

/** How wide the die lies on the ground at this zoom, in pixels: its width in world units, at the ground's scale. */
function landedAt(look: DieLook, zoom: number): number {
  return look.landedWide * pixelsPerWorldUnit(zoom);
}

export async function startDieStage(
  host: HTMLElement,
  map: maplibregl.Map,
  settings: () => DieSettings,
  onRested: (rested: Rested) => void,
): Promise<DieStage> {
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: true,
    resizeTo: host,
    autoStart: false,
    autoDensity: true,
    resolution: window.devicePixelRatio,
  });
  app.canvas.classList.add('die-stage__canvas');
  host.appendChild(app.canvas);

  const ring = new Graphics();
  const standIns = new Graphics();
  const die = createDieDrawing();
  const dust = createDust();
  app.stage.addChild(ring, die.shadow, standIns, dust.graphics, die.body, die.pin);

  let now: Now = { kind: 'idle' };
  let planted: StandIns = standInsAround(
    mercatorOf({ x: host.clientWidth / 2, y: host.clientHeight / 2 }, viewOf(map)),
  );
  let knocked = 0;
  let asked: number | null = null;

  const drawRing = (ground: ScreenPoint, view: CameraView, place: MercatorPoint, t: number, flash: number) =>
    drawLandingCircle(ring, ground, view, place, settings().circleKm, t, flash);

  /** Draws a die that has been let go: in its flight, or on the ground once it has struck it. */
  const drawThrown = (thrown: Thrown, view: CameraView, chosen: DieSettings, t: number) => {
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
      drawRing(ground, view, place, t, 0);
      return false;
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
    if (chosen.juice) {
      while (knocked < thrown.path.knocks.length && thrown.path.knocks[knocked]!.time <= onGround) {
        const knock = thrown.path.knocks[knocked]!;
        knocked += 1;
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
    drawRing(ground, view, place, t, flash);
    return done;
  };

  const frame = () => {
    asked = null;
    const t = performance.now();
    const view = viewOf(map);
    const chosen = settings();
    const pitch = view.pitch ?? 0;
    standIns.clear();
    if (chosen.striking) drawStandIns(standIns, planted, view, seenAt(chosen.look, pitch));

    if (now.kind === 'idle') {
      die.hide();
      ring.clear();
    } else if (now.kind === 'held') {
      const ground = heldGround(now.at, now.byTouch, chosen, pitch);
      const held = { at: { x: 0, y: 0, z: 0.5 }, turn: heldTurn(now.since, t) };
      const lift = inTheHandLift(chosen.look, pitch);
      die.draw(
        ground,
        held,
        LAYOUT,
        pitch,
        chosen.look,
        0,
        chosen.look.size,
        landedAt(chosen.look, view.zoom),
        lift,
      );
      drawRing(ground, view, mercatorOf(ground, view), t, 0);
    } else if (drawThrown(now, view, chosen, t) && now.kind === 'flying') {
      now = { ...now, kind: 'resting' };
      onRested(now.rested);
    }
    const lean = Math.cos((pitch * Math.PI) / 180);
    const dusty = dust.draw(t, lean);
    app.render();
    if (now.kind !== 'idle' || dusty) ask();
  };

  const ask = () => {
    if (asked === null) asked = requestAnimationFrame(frame);
  };
  // Drawn when the map draws, on its own render, rather than on a frame of this canvas's own: one camera, read once,
  // into one browser frame, as the game's sprite canvas does. A frame behind, the die slid over the ground as the map
  // moved, and was plainly a thing laid over it rather than on it.
  const withTheMap = () => {
    if (asked !== null) cancelAnimationFrame(asked);
    frame();
  };
  map.on('render', withTheMap);
  map.on('resize', withTheMap);

  const release = (ground: ScreenPoint, speed: { x: number; y: number }, turn: Quat, t: number) => {
    const view = viewOf(map);
    const chosen = settings();
    // The die's physics is in die widths, and a die width is its width lying on the ground: a world-sized thing, so a
    // throw rolls over the same ground at every zoom, and its flight carries as far on the screen as the flick was hard.
    const landed = landedAt(chosen.look, view.zoom);
    const anchor = mercatorOf(ground, view);
    const perDie = chosen.look.landedWide / WORLD_MASTER_WIDTH;
    const thrown = isThrow(speed, chosen.throwsFrom);
    const across = untiltGround(speed.x, speed.y, groundTilt(view));
    const distance = thrown ? Math.hypot(across.east, across.south) * chosen.flight.carries : 0;
    const flight = flightOf(distance, Math.atan2(across.south, across.east), landed, turn, chosen.flight);
    const end = flownAt(flight, flight.seconds);
    // Where the arc ends, and the ground's unit there: as wide as the die is drawn, a pin's width far out.
    const struck = { x: anchor.x + end.x * perDie, y: anchor.y + end.y * perDie };
    const unit = asItLies(landed, view.zoom);
    const perUnit = unit / worldSize(view.zoom);
    // How far it fell, as how many times smaller it lies on the ground than it was in the hand: a mark far out fell far.
    const shrank = chosen.look.size / landed;
    const landing = landingOf(flight, chosen.flight, chosen.feel, chosen.look.hang, unit, shrank);
    const obstacles: Obstacle[] = chosen.striking
      ? standInsInDieWidths(planted, struck, unit / pixelsPerWorldUnit(view.zoom))
      : [];
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
    knocked = 0;
    now = {
      kind: 'flying',
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
    map.dragPan.enable();
    ask();
  };

  return {
    pickUp(at, byTouch, t) {
      map.dragPan.disable();
      now = { kind: 'held', at, byTouch, since: t, samples: [{ t, x: at.x, y: at.y }] };
      ask();
    },
    move(at, t) {
      if (now.kind !== 'held') return;
      now.at = at;
      now.samples = kept([...now.samples, { t, x: at.x, y: at.y }], t);
      ask();
    },
    letGo(t) {
      if (now.kind !== 'held') return;
      const ground = heldGround(now.at, now.byTouch, settings(), map.getPitch());
      release(ground, speedAtRelease(now.samples, t), heldTurn(now.since, t), t);
    },
    putBack() {
      map.dragPan.enable();
      now = { kind: 'idle' };
      ask();
    },
    dropAtCentre(t) {
      release({ x: host.clientWidth / 2, y: host.clientHeight / 2 }, { x: 0, y: 0 }, heldTurn(t, t), t);
    },
    plant() {
      planted = standInsAround(
        mercatorOf({ x: host.clientWidth / 2, y: host.clientHeight / 2 }, viewOf(map)),
      );
      ask();
    },
    stop() {
      if (asked !== null) cancelAnimationFrame(asked);
      map.off('render', withTheMap);
      map.off('resize', withTheMap);
      map.dragPan.enable();
      die.destroy();
      dust.destroy();
      app.destroy(true, { children: true });
    },
  };
}

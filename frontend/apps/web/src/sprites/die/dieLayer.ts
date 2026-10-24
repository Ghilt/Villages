import { Container, Graphics } from 'pixi.js';

import { groundTilt, toMercatorExact } from '../../geometry/cameraMath';
import type { CameraView, MercatorPoint, ScreenPoint } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { note } from '../../log/log';
import type { Layer } from '../layer';
import type { StandingLayer, StandingThing } from '../standing/StandingLayer';
import { createDieDrawing, createDust } from './dieDrawing';
import { kept, speedAtRelease } from './gesture';
import type { Sample } from './gesture';
import { holdTheDie } from './hand';
import type { DieHand, HandAt, Landing } from './hand';
import { heldTurn } from './playback';
import { pulsesAround } from './structuresStruck';
import { layoutShowing } from './pips';
import { DIE_SETTINGS, drawHeld, drawLying, drawThrown, heldGround, letGo } from './throwing';
import type { DieParts, DieSettings, Thrown } from './throwing';

/**
 * The choice roll's die on the game's sprite canvas: held under the pointer or above the finger with the landing circle
 * round its shadow; let go still, it drops by its shadow, and with a flick it is thrown the way the hand went, the
 * hand's speed read over its last tenth of a second; played back pinned to the ground, and lying where it rests with
 * its ring breathing until it is put back - or, on a page that reloads with its hand open, lying there with no throw
 * behind it. The number on top is painted on as the throw is worked out, a number the
 * page chooses, since what it means is not decided. Of the info layer, over the fog and the clouds and every sign
 * (0096, 0118) - until it comes to rest, when it sinks in among the trees and the structures standing, a drawing of it
 * there and the one over everything fading out, so it can lie behind a tree or a building; its ring stays over
 * everything. Adam's word of 2026-10-24, everywhere, though it goes under the fog and the grey out of sight with them.
 * Fetched only once the game has started, and it says it is here through `hand.ts`, which the pane holds it by. See
 * `docs/plans/choice-roll-podium.md`.
 */

/** How often a die at rest is drawn again, for its ring's breath: twenty times a second is plenty for a slow light. */
const BREATHES_MS = 50;
/** How long the die over everything takes to fade out once it is at rest, leaving it among the trees. */
const SINKS_MS = 400;
/** What the die stands among the trees as, apart from everything else standing there. */
const DIE = 'die';

type Now =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'held';
      at: ScreenPoint;
      readonly byTouch: boolean;
      readonly since: number;
      /** Where the hand was lately, on the map, and when: what a flick is read from. */
      samples: Sample[];
    }
  | {
      readonly kind: 'flying';
      readonly thrown: Thrown;
      readonly rested: () => void;
    }
  /** At rest where its throw left it, and since when. */
  | { readonly kind: 'resting'; readonly thrown: Thrown; readonly since: number }
  /** Lying where a roll's die fell, with no throw behind it: drawn by a page that reloaded with its hand open. */
  | { readonly kind: 'lying'; readonly place: MercatorPoint; readonly since: number };

export interface DieLayer extends Layer {
  /** What it draws into, for the renderer to lay over everything. */
  readonly view: Container;
}

/**
 * A die layer drawing over the map in `box`, asking for a frame through `repaint` when a hand moves it, its die blown off
 * the structures of `standing` it would come to rest on, and lying among them once it has.
 */
export function createDieLayer(
  box: HTMLElement,
  repaint: () => void,
  standing: () => StandingLayer | null,
): DieLayer {
  const view = new Container();
  const parts = { die: createDieDrawing(), dust: createDust(), ring: new Graphics() };
  view.addChild(parts.ring, parts.die.shadow, parts.dust.graphics, parts.die.body, parts.die.pin);
  parts.die.hide();
  // The die at rest among the trees: drawn as the one over everything is, its own dust and ring never shown.
  const among: DieParts = { die: createDieDrawing(), dust: createDust(), ring: new Graphics() };
  const amongView = new Container();
  amongView.addChild(among.die.shadow, among.die.body, among.die.pin);
  among.die.hide();

  let settings: DieSettings = DIE_SETTINGS;
  let now: Now = { kind: 'idle' };
  let knocked = 0;
  /** The camera of the last frame drawn, which a die let go between frames is let go under. */
  let camera: CameraView | null = null;

  const othersStanding = () => (standing()?.everything() ?? []).filter((thing) => thing.id !== DIE);
  /** Stands the die among the trees at `place`, or takes it away with null, and fades the one over everything. */
  const standAt = (place: MercatorPoint | null, since: number, t: number) => {
    standing()?.stand(place === null ? [] : [dieStanding(place, amongView)], DIE);
    const over = place === null ? 1 : Math.max(0, 1 - (t - since) / SINKS_MS);
    for (const part of [parts.die.shadow, parts.die.body, parts.die.pin]) part.alpha = over;
    if (place === null) among.die.hide();
    return over > 0;
  };

  const onTheMap = (at: HandAt): ScreenPoint => {
    const edges = box.getBoundingClientRect();
    return { x: at.x - edges.left, y: at.y - edges.top };
  };
  const fall = (
    ground: ScreenPoint,
    speed: { x: number; y: number },
    turnedSince: number,
    told: (landing: Landing) => void,
    rested: () => void,
  ) => {
    if (camera === null) return;
    const t = performance.now();
    const tilt = groundTilt(camera);
    // Any number on top until the roll it was thrown for has drawn its rarity, which `show` paints on (0118).
    const showing = 1 + Math.floor(Math.random() * 6);
    const thrown = letGo(
      ground,
      speed,
      heldTurn(turnedSince, t),
      camera,
      { ...settings, showing, striking: true },
      () => [],
      t,
      (struck, unitWide, gravity) => pulsesAround(othersStanding(), struck, unitWide, tilt, gravity),
    );
    const { near, pulsed } = thrown.rested;
    if (near > 0) {
      const blown =
        pulsed === 0 ? 'it came to rest clear' : `${pulsed} pulse${pulsed === 1 ? '' : 's'} blew it off`;
      note('die', `the die came down near ${near} structure${near === 1 ? '' : 's'}: ${blown}`);
    }
    knocked = 0;
    now = { kind: 'flying', thrown, rested };
    told({ lat: thrown.rested.lat, lon: thrown.rested.lon });
    repaint();
  };

  const hand: DieHand = {
    pickUp(at, byTouch, circleKm) {
      settings = { ...DIE_SETTINGS, circleKm };
      const there = onTheMap(at);
      now = { kind: 'held', at: there, byTouch, since: at.at, samples: [{ t: at.at, ...there }] };
      repaint();
    },
    move(path) {
      const last = path[path.length - 1];
      if (now.kind !== 'held' || last === undefined) return;
      const passed = path.map((step) => ({ t: step.at, ...onTheMap(step) }));
      now.samples = kept([...now.samples, ...passed], last.at);
      now.at = onTheMap(last);
      repaint();
    },
    letGo(at, told, rested) {
      if (now.kind !== 'held' || camera === null) return;
      const ground = heldGround(onTheMap(at), now.byTouch, settings, camera.pitch ?? 0);
      fall(ground, speedAtRelease(now.samples, at.at), now.since, told, rested);
    },
    putBack() {
      now = { kind: 'idle' };
      repaint();
    },
    dropAtCentre(circleKm, told, rested) {
      if (camera === null) return;
      settings = { ...DIE_SETTINGS, circleKm };
      fall({ x: camera.width / 2, y: camera.height / 2 }, { x: 0, y: 0 }, performance.now(), told, rested);
    },
    show(number) {
      if (now.kind !== 'flying' && now.kind !== 'resting') return;
      const { thrown } = now;
      const numbers = layoutShowing(thrown.path.up, number);
      now = { ...now, thrown: { ...thrown, numbers, rested: { ...thrown.rested, came: number } } };
      repaint();
    },
    lieAt(landing, circleKm) {
      if (now.kind !== 'idle') return;
      settings = { ...DIE_SETTINGS, circleKm };
      now = {
        kind: 'lying',
        place: toMercatorExact({ lng: landing.lon, lat: landing.lat }),
        since: -Infinity,
      };
      repaint();
    },
  };
  holdTheDie(hand);

  return {
    view,
    draw(cameraView: CameraView, t: number): number | null {
      camera = cameraView;
      const pitch = cameraView.pitch ?? 0;
      let wants: number | null = null;
      if (now.kind === 'idle') {
        standAt(null, 0, t);
        parts.die.hide();
        parts.ring.clear();
      } else if (now.kind === 'held') {
        standAt(null, 0, t);
        drawHeld(parts, heldGround(now.at, now.byTouch, settings, pitch), now.since, cameraView, settings, t);
        wants = 0;
      } else if (now.kind === 'lying') {
        const sinking = standAt(now.place, now.since, t);
        drawLying(parts, now.place, cameraView, settings, t);
        drawLying(among, now.place, cameraView, settings, t);
        wants = sinking ? 0 : BREATHES_MS;
      } else if (now.kind === 'resting') {
        const place = toMercatorExact({ lng: now.thrown.rested.lon, lat: now.thrown.rested.lat });
        const sinking = standAt(place, now.since, t);
        drawThrown(parts, now.thrown, cameraView, settings, t, knocked);
        drawThrown(among, now.thrown, cameraView, { ...settings, juice: false }, t, knocked);
        wants = sinking ? 0 : BREATHES_MS;
      } else {
        standAt(null, 0, t);
        const drawn = drawThrown(parts, now.thrown, cameraView, settings, t, knocked);
        knocked = drawn.knocked;
        if (drawn.done) {
          now.rested();
          now = { kind: 'resting', thrown: now.thrown, since: t };
        }
        wants = 0;
      }
      const dusty = parts.dust.draw(t, Math.cos((pitch * Math.PI) / 180));
      return dusty ? 0 : wants;
    },
    destroy() {
      holdTheDie(null);
      standing()?.stand([], DIE);
      among.die.destroy();
      among.dust.destroy();
      among.ring.destroy();
      amongView.destroy();
      parts.die.destroy();
      parts.dust.destroy();
      parts.ring.destroy();
      view.destroy();
    },
  };
}

/**
 * The die lying at `place` as something standing among the trees: as wide and as tall as it lies, on a square of
 * ground of its own width, so the trees and the structures in front of it are drawn over it.
 */
function dieStanding(place: MercatorPoint, drawn: Container): StandingThing {
  const at = { x: place.x * WORLD_MASTER_WIDTH, y: place.y * WORLD_MASTER_WIDTH };
  const half = DIE_SETTINGS.look.landedWide / 2;
  return {
    id: DIE,
    sprites: [drawn],
    place: at,
    anchor: 0.5,
    footprint: [
      { x: at.x, y: at.y + half },
      { x: at.x + half, y: at.y },
      { x: at.x, y: at.y - half },
      { x: at.x - half, y: at.y },
    ],
    tall: half * 2,
    wide: half * 2,
    shown: true,
  };
}

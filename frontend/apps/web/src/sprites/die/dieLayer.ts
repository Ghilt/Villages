import { Container, Graphics } from 'pixi.js';

import type { CameraView, ScreenPoint } from '../../geometry/cameraMath';
import type { Layer } from '../layer';
import { createDieDrawing, createDust } from './dieDrawing';
import { kept, speedAtRelease } from './gesture';
import type { Sample } from './gesture';
import { holdTheDie } from './hand';
import type { DieHand, HandAt, Landing } from './hand';
import { heldTurn } from './playback';
import { DIE_SETTINGS, drawHeld, drawThrown, heldGround, letGo } from './throwing';
import type { DieSettings, Thrown } from './throwing';

/**
 * The choice roll's die on the game's sprite canvas: held under the pointer or above the finger with the landing circle
 * round its shadow; let go still, it drops by its shadow, and with a flick it is thrown the way the hand went, the
 * hand's speed read over its last tenth of a second; played back pinned to the ground, and lying where it rests with
 * its ring breathing until it is put back. The number on top is painted on as the throw is worked out, a number the
 * page chooses, since what it means is not decided. Of the info layer, over the fog and the clouds and every sign
 * (0096, 0118). Fetched only once the game has started, and it says it is here through `hand.ts`, which the pane
 * holds it by. See `docs/plans/choice-roll-podium.md`.
 */

/** How often a die at rest is drawn again, for its ring's breath: twenty times a second is plenty for a slow light. */
const BREATHES_MS = 50;

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
      readonly kind: 'flying' | 'resting';
      readonly thrown: Thrown;
      readonly rested: (landing: Landing) => void;
    };

export interface DieLayer extends Layer {
  /** What it draws into, for the renderer to lay over everything. */
  readonly view: Container;
}

/** A die layer drawing over the map in `box`, asking for a frame through `repaint` when a hand moves it. */
export function createDieLayer(box: HTMLElement, repaint: () => void): DieLayer {
  const view = new Container();
  const parts = { die: createDieDrawing(), dust: createDust(), ring: new Graphics() };
  view.addChild(parts.ring, parts.die.shadow, parts.dust.graphics, parts.die.body, parts.die.pin);
  parts.die.hide();

  let settings: DieSettings = DIE_SETTINGS;
  let now: Now = { kind: 'idle' };
  let knocked = 0;
  /** The camera of the last frame drawn, which a die let go between frames is let go under. */
  let camera: CameraView | null = null;

  const onTheMap = (at: HandAt): ScreenPoint => {
    const edges = box.getBoundingClientRect();
    return { x: at.x - edges.left, y: at.y - edges.top };
  };
  const fall = (
    ground: ScreenPoint,
    speed: { x: number; y: number },
    turnedSince: number,
    rested: (landing: Landing) => void,
  ) => {
    if (camera === null) return;
    const t = performance.now();
    // The number the game wants on top, painted on the face the throw leaves there: the page's own for now (0118).
    const showing = 1 + Math.floor(Math.random() * 6);
    const thrown = letGo(
      ground,
      speed,
      heldTurn(turnedSince, t),
      camera,
      { ...settings, showing },
      () => [],
      t,
    );
    knocked = 0;
    now = { kind: 'flying', thrown, rested };
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
    letGo(at, rested) {
      if (now.kind !== 'held' || camera === null) return;
      const ground = heldGround(onTheMap(at), now.byTouch, settings, camera.pitch ?? 0);
      fall(ground, speedAtRelease(now.samples, at.at), now.since, rested);
    },
    putBack() {
      now = { kind: 'idle' };
      repaint();
    },
    dropAtCentre(circleKm, rested) {
      if (camera === null) return;
      settings = { ...DIE_SETTINGS, circleKm };
      fall({ x: camera.width / 2, y: camera.height / 2 }, { x: 0, y: 0 }, performance.now(), rested);
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
        parts.die.hide();
        parts.ring.clear();
      } else if (now.kind === 'held') {
        drawHeld(parts, heldGround(now.at, now.byTouch, settings, pitch), now.since, cameraView, settings, t);
        wants = 0;
      } else {
        const drawn = drawThrown(parts, now.thrown, cameraView, settings, t, knocked);
        knocked = drawn.knocked;
        if (drawn.done && now.kind === 'flying') {
          now = { ...now, kind: 'resting' };
          now.rested({ lat: now.thrown.rested.lat, lon: now.thrown.rested.lon });
        }
        wants = now.kind === 'resting' ? BREATHES_MS : 0;
      }
      const dusty = parts.dust.draw(t, Math.cos((pitch * Math.PI) / 180));
      return dusty ? 0 : wants;
    },
    destroy() {
      holdTheDie(null);
      parts.die.destroy();
      parts.dust.destroy();
      parts.ring.destroy();
      view.destroy();
    },
  };
}

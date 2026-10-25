import { Application, Graphics } from 'pixi.js';
import type * as maplibregl from 'maplibre-gl';

import type { ScreenPoint } from '../../geometry/cameraMath';
import { createDieDrawing, seenAt } from '../../sprites/die/dieDrawing';
import { createDust } from '../../sprites/die/dust';
import { kept, speedAtRelease } from '../../sprites/die/gesture';
import type { Sample } from '../../sprites/die/gesture';
import { mercatorOf } from '../../sprites/die/onTheGround';
import type { Quat } from '../../sprites/die/physics';
import { heldTurn } from '../../sprites/die/playback';
import { drawHeld, drawThrown, heldGround, letGo } from '../../sprites/die/throwing';
import type { DieSettings, Rested, Thrown } from '../../sprites/die/throwing';

import { viewOf } from './onTheMap';
import { drawStandIns, standInsAround, standInsInDieWidths } from './standIns';
import type { StandIns } from './standIns';

export type { DieSettings, Rested };

/**
 * The spike's stage: a Pixi canvas over the map, where the die is held, let go, flown along its arc and played back on
 * the ground, pinned to it, with the landing circle round it and the stand-ins it can strike. The die itself is
 * `sprites/die/throwing.ts`, which the game draws on its sprite canvas too; this is the spike's own canvas and its
 * stand-ins.
 */

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

type Held = {
  readonly kind: 'held';
  at: ScreenPoint;
  readonly byTouch: boolean;
  readonly since: number;
  samples: Sample[];
};
type Now =
  | { readonly kind: 'idle' }
  | Held
  | ({ readonly kind: 'flying' } & Thrown)
  | ({ readonly kind: 'resting' } & Thrown);

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

  const parts = { die: createDieDrawing(), dust: createDust(), ring: new Graphics() };
  const standIns = new Graphics();
  app.stage.addChild(
    parts.ring,
    parts.die.shadow,
    standIns,
    parts.dust.graphics,
    parts.die.body,
    parts.die.pin,
  );

  let now: Now = { kind: 'idle' };
  let planted: StandIns = standInsAround(
    mercatorOf({ x: host.clientWidth / 2, y: host.clientHeight / 2 }, viewOf(map)),
  );
  let knocked = 0;
  let asked: number | null = null;

  const frame = () => {
    asked = null;
    const t = performance.now();
    const view = viewOf(map);
    const chosen = settings();
    const pitch = view.pitch ?? 0;
    standIns.clear();
    if (chosen.striking) drawStandIns(standIns, planted, view, seenAt(chosen.look, pitch));

    if (now.kind === 'idle') {
      parts.die.hide();
      parts.ring.clear();
    } else if (now.kind === 'held') {
      drawHeld(parts, heldGround(now.at, now.byTouch, chosen, pitch), now.since, view, chosen, t);
    } else {
      const drawn = drawThrown(parts, now, view, chosen, t, knocked);
      knocked = drawn.knocked;
      if (drawn.done && now.kind === 'flying') {
        now = { ...now, kind: 'resting' };
        onRested(now.rested);
      }
    }
    const dusty = parts.dust.draw(t, Math.cos((pitch * Math.PI) / 180));
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
    knocked = 0;
    const thrown = letGo(
      ground,
      speed,
      turn,
      view,
      settings(),
      (struck, dieWide) => standInsInDieWidths(planted, struck, dieWide),
      t,
    );
    now = { kind: 'flying', ...thrown };
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
      parts.die.destroy();
      parts.dust.destroy();
      app.destroy(true, { children: true });
    },
  };
}

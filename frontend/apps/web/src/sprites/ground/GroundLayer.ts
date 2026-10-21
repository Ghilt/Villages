import {
  BufferImageSource,
  Geometry,
  GlProgram,
  Mesh,
  RenderTexture,
  Shader,
  Sprite,
  UniformGroup,
} from 'pixi.js';
import type { Renderer } from 'pixi.js';

import { GROUND_LATTICE, alongU, alongV, frameOf } from '@villages/world';

import { groundTilt, pixelsPerWorldUnit, toMercatorExact } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { groundAt } from '../land/landMask';
import type { Layer } from '../layer';
import { BECOMES_A_MARK_AT } from '../twoForms';

import { GROUND_FRAGMENT, GROUND_VERTEX } from './groundShader';
import { covers, fillWindow, windowFor } from './groundWindow';
import type { GroundWindow, LatticeBounds } from './groundWindow';
import { workedGroundStore } from './settings';
import type { Worked } from './worked';

/**
 * The ground worn bare under the buildings, as a layer of the sprite canvas: over the land's motion, so no tuft moves
 * on it, and under the critters, the scenery's shadows and the trees, in the container the fog takes the colour out
 * of, so it is hazed and loses its colour on ground only revealed exactly as the buildings on it do. What is worn is
 * worked out from the buildings the page holds (`workedGround.ts`); this hands the graphics card the window of it
 * the view needs and draws it in one pass over the screen (`groundShader.ts`). It comes in with the buildings' ground
 * form at 7.5 and asks for no frames of its own: it is still. See docs/plans/worked-ground.md.
 */

/** One triangle that covers the screen, in clip space, so the fragment shader runs once for every pixel. */
const COVER = new Float32Array([-1, -1, 3, -1, -1, 3]);

const FRAME = frameOf(GROUND_LATTICE);

const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** The stretch of the ground's lattice under the view's four corners. */
function latticeUnder(view: CameraView): LatticeBounds {
  const corners = [
    groundAt(view, 0, 0),
    groundAt(view, view.width, 0),
    groundAt(view, 0, view.height),
    groundAt(view, view.width, view.height),
  ];
  const us = corners.map((one) => alongU(FRAME, one.x, one.y));
  const vs = corners.map((one) => alongV(FRAME, one.x, one.y));
  return { fromU: Math.min(...us), toU: Math.max(...us), fromV: Math.min(...vs), toV: Math.max(...vs) };
}

/** `#rrggbb` as three channels, nought to one. */
function channelsOf(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export interface GroundLayer extends Layer {
  /** The worked ground as it is drawn: a picture the size of the screen, to go over the land and under the rest. */
  sprite: Sprite;
  /** The ground the buildings now on the map wear. */
  setWorked(worked: ReadonlyMap<number, Worked>): void;
}

export function createGroundLayer(renderer: Renderer, repaint: () => void): GroundLayer {
  const uniforms = new UniformGroup({
    uSize: { value: new Float32Array(2), type: 'vec2<f32>' },
    uCentre: { value: new Float32Array(2), type: 'vec2<f32>' },
    uScale: { value: 1, type: 'f32' },
    uTilt: { value: new Float32Array([1, 0, 1]), type: 'vec3<f32>' },
    uTurn: { value: new Float32Array([FRAME.cos, FRAME.sin]), type: 'vec2<f32>' },
    uWindowOrigin: { value: new Float32Array(2), type: 'vec2<f32>' },
    uWindowSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uEarth: { value: new Float32Array(3), type: 'vec3<f32>' },
    uStrength: { value: 1, type: 'f32' },
    uFade: { value: 0, type: 'f32' },
    uGrass: { value: 0, type: 'f32' },
    uRoad: { value: new Float32Array(3), type: 'vec3<f32>' },
  });
  const nothing = new BufferImageSource({
    resource: new Uint8Array(1),
    width: 1,
    height: 1,
    format: 'r8unorm',
  });
  const shader = new Shader({
    glProgram: GlProgram.from({
      vertex: GROUND_VERTEX,
      fragment: GROUND_FRAGMENT,
      name: 'worked-ground',
      // World units run to 32768, which a medium-precision float cannot place to within a unit.
      preferredFragmentPrecision: 'highp',
    }),
    resources: { groundUniforms: uniforms, uWorked: nothing },
  });
  const mesh = new Mesh({
    geometry: new Geometry({
      attributes: { aPosition: { buffer: COVER, format: 'float32x2', stride: 8, offset: 0 } },
    }),
    shader,
  });
  const target = RenderTexture.create({ width: 1, height: 1, dynamic: true, scaleMode: 'linear' });
  const sprite = new Sprite(target);
  sprite.visible = false;

  let worked: ReadonlyMap<number, Worked> = new Map();
  /** The window handed to the graphics card, and its bytes; null until one is needed, and again when stale. */
  let held: { at: GroundWindow; source: BufferImageSource } | null = null;
  let stale = true;
  const stopWatching = workedGroundStore.watch(repaint);

  /** The window the view needs, made again when the view has left the one held or the buildings changed. */
  function windowOfView(view: CameraView): GroundWindow | null {
    const bounds = latticeUnder(view);
    if (!stale && held !== null && covers(held.at, bounds)) {
      return held.at;
    }
    const at = windowFor(bounds);
    if (at === null) {
      return null;
    }
    const source = new BufferImageSource({
      resource: fillWindow(worked, at),
      width: at.width,
      height: at.height,
      format: 'r8unorm',
      // Read as they are, a kind a diamond, never blended between two.
      scaleMode: 'nearest',
      addressMode: 'clamp-to-edge',
      autoGenerateMipmaps: false,
    });
    // The new one bound before the old one goes: one destroyed while still bound leaves the shader holding nothing.
    const previous = held;
    shader.resources.uWorked = source;
    held = { at, source };
    stale = false;
    previous?.source.destroy();
    return at;
  }

  return {
    sprite,

    setWorked(next: ReadonlyMap<number, Worked>): void {
      if (next === worked) {
        return;
      }
      worked = next;
      stale = true;
      repaint();
    },

    draw(view: CameraView): number | null {
      const { strength, earth, grass, road } = workedGroundStore.get();
      const fade = smoothstep(BECOMES_A_MARK_AT, BECOMES_A_MARK_AT + 0.5, view.zoom);
      const at = fade > 0 && worked.size > 0 ? windowOfView(view) : null;
      if (at === null) {
        sprite.visible = false;
        return null;
      }
      const centre = toMercatorExact(view.center);
      const tilt = groundTilt(view);
      const u = uniforms.uniforms;
      u.uSize[0] = view.width;
      u.uSize[1] = view.height;
      u.uCentre[0] = centre.x * WORLD_MASTER_WIDTH;
      u.uCentre[1] = centre.y * WORLD_MASTER_WIDTH;
      u.uScale = pixelsPerWorldUnit(view.zoom);
      u.uTilt[0] = tilt.cos;
      u.uTilt[1] = tilt.sin;
      u.uTilt[2] = tilt.lean;
      u.uWindowOrigin[0] = at.u;
      u.uWindowOrigin[1] = at.v;
      u.uWindowSize[0] = at.width;
      u.uWindowSize[1] = at.height;
      const [red, green, blue] = channelsOf(earth);
      u.uEarth[0] = red;
      u.uEarth[1] = green;
      u.uEarth[2] = blue;
      u.uStrength = strength;
      u.uFade = fade;
      u.uGrass = grass;
      const [roadRed, roadGreen, roadBlue] = channelsOf(road);
      u.uRoad[0] = roadRed;
      u.uRoad[1] = roadGreen;
      u.uRoad[2] = roadBlue;
      uniforms.update();

      const resolution = renderer.resolution;
      const width = Math.max(1, Math.ceil(view.width));
      const height = Math.max(1, Math.ceil(view.height));
      if (target.width !== width || target.height !== height || target.source.resolution !== resolution) {
        target.resize(width, height, resolution);
      }
      renderer.render({ container: mesh, target, clear: true, clearColor: [0, 0, 0, 0] });
      sprite.visible = true;
      sprite.width = view.width;
      sprite.height = view.height;
      return null;
    },

    destroy(): void {
      stopWatching();
      sprite.destroy();
      target.destroy(true);
      mesh.destroy();
      shader.destroy();
      held?.source.destroy();
      nothing.destroy();
    },
  };
}

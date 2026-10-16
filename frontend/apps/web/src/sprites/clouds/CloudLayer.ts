import { Geometry, GlProgram, Mesh, RenderTexture, Shader, Sprite, UniformGroup } from 'pixi.js';
import type { Renderer, WebGLRenderer } from 'pixi.js';

import { groundTilt, pixelsPerWorldUnit, toMercatorExact } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { note } from '../../log/log';
import { createCostMeter } from '../../shaders/costMeter';
import { drawnAt, sayLevel, shadersStore } from '../../shaders/levels';
import type { ShaderLevel } from '../../shaders/levels';
import type { Layer } from '../layer';

import { cloudBandAt } from './cloudBands';
import { carriedBy, latticeNear, respeed, sharedDrift } from './cloudClock';
import { cloudStore, readClouds } from './cloudMode';
import { CLOUD_DEFAULTS, cloudTuningStore } from './cloudTuning';
import { CLOUD_FRAGMENT, CLOUD_VERTEX } from './cloudShader';
import { CLOUD_LOOK } from './look';

/**
 * The clouds, as a layer of the sprite canvas: over the fog and everything under it, under the selection ring and
 * the marks, so they drift over the haze and never over a sign. See decision record 0098.
 *
 * Worked out into a picture of its own at its level's share of the screen, then laid over the whole screen, as the
 * grass is. Where they are comes from the wall clock rather than from when the page opened, so every browser draws
 * the same sky. It asks for frames at its level's rate while some cloud is on the screen and for none otherwise, so
 * the sprite canvas redraws for it and the map does not; still for anyone who has asked for less motion. The first
 * time it is drawn at a level it says once in the log what that costs the graphics card.
 */

/** One triangle that covers the screen, in clip space, so the fragment shader runs once for every pixel. */
const COVER = new Float32Array([-1, -1, 3, -1, -1, 3]);

export interface CloudLayer extends Layer {
  /** The clouds as they are drawn: a picture the size of the screen, to go over the fog. */
  sprite: Sprite;
}

export function createCloudLayer(renderer: Renderer, repaint: () => void): CloudLayer {
  const uniforms = new UniformGroup({
    uSize: { value: new Float32Array(2), type: 'vec2<f32>' },
    uCentre: { value: new Float32Array(2), type: 'vec2<f32>' },
    uScale: { value: 1, type: 'f32' },
    uTilt: { value: new Float32Array([1, 0, 1]), type: 'vec3<f32>' },
    uAmount: { value: 0, type: 'f32' },
    uCarried: { value: new Float32Array(3), type: 'vec3<f32>' },
    uClumps: { value: new Float32Array(2), type: 'vec2<f32>' },
    uPatches: { value: new Float32Array(2), type: 'vec2<f32>' },
    uWarp: { value: new Float32Array(2), type: 'vec2<f32>' },
    uCover: { value: 0, type: 'f32' },
    uPatchWeight: { value: 0, type: 'f32' },
    uEdge: { value: 0, type: 'f32' },
    uShadow: { value: 0, type: 'f32' },
    uReach: { value: 0, type: 'f32' },
    uMagnify: { value: 1, type: 'f32' },
    uInside: { value: 0, type: 'f32' },
  });
  const shader = new Shader({
    glProgram: GlProgram.from({
      vertex: CLOUD_VERTEX,
      fragment: CLOUD_FRAGMENT,
      name: 'clouds',
      // World units run to 32768, which a medium-precision float cannot place to within a unit.
      preferredFragmentPrecision: 'highp',
    }),
    resources: { cloudUniforms: uniforms },
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

  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A still sky is the sky as it was when the page opened.
  const stillAt = Date.now();
  // How the wind carries the patches, the clumps, and their detail with the warp: the one sky until a slider
  // moves a speed.
  const paces = (tuning: { speed: number; change: number }) => [
    tuning.speed * CLOUD_LOOK.patchPace,
    tuning.speed,
    tuning.speed * (1 + tuning.change),
  ];
  const sharedPaces = paces(CLOUD_DEFAULTS);
  let drifts = paces(cloudTuningStore.get()).map(sharedDrift);

  // What each level costs, measured on the graphics card where it will say, and said once a level.
  const meter = createCostMeter((renderer as WebGLRenderer).gl as WebGL2RenderingContext | undefined);
  const measured = new Set<ShaderLevel>();
  let lastLevel: ShaderLevel | null = null;

  const stopWatching = cloudStore.watch(repaint);
  const stopWatchingShaders = shadersStore.watch(repaint);
  // A slider moved shows on the next frame even where nothing else is moving the map.
  const stopWatchingTuning = cloudTuningStore.watch(repaint);

  return {
    sprite,

    draw(view: CameraView): number | null {
      const level = drawnAt(cloudStore.get().level);
      const ms = meter.read();
      if (ms !== null && lastLevel !== null && lastLevel !== 'off') {
        measured.add(lastLevel);
        const look = CLOUD_LOOK.levels[lastLevel];
        const share = ((ms * look.framesPerSecond) / 10).toFixed(1);
        note(
          'clouds',
          `${sayLevel(lastLevel, look)}: ${ms.toFixed(2)} ms of the graphics card a frame, ${share}% of its time`,
        );
      }
      const tuning = cloudTuningStore.get();
      const band = cloudBandAt(view.zoom, tuning);
      readClouds(band.name, level === 'off' ? 0 : band.clouds);
      if (level === 'off' || band.clouds <= 0) {
        sprite.visible = false;
        return null;
      }
      const levelLook = CLOUD_LOOK.levels[level];
      if (level !== lastLevel) {
        lastLevel = level;
        if (!measured.has(level)) meter.again();
      }

      const centre = toMercatorExact(view.center);
      const tilt = groundTilt(view);
      const resolution = renderer.resolution;
      const clumps = latticeNear(tuning.size);
      const patches = latticeNear(tuning.size * 16);
      const warp = latticeNear(tuning.size * 2);
      const at = still ? stillAt : Date.now();
      const wanted = paces(tuning);
      drifts = drifts.map((drift, part) => respeed(drift, at, wanted[part]!, sharedPaces[part]!));
      const u = uniforms.uniforms;
      u.uSize[0] = view.width;
      u.uSize[1] = view.height;
      u.uCentre[0] = centre.x * WORLD_MASTER_WIDTH;
      u.uCentre[1] = centre.y * WORLD_MASTER_WIDTH;
      u.uScale = pixelsPerWorldUnit(view.zoom);
      u.uTilt[0] = tilt.cos;
      u.uTilt[1] = tilt.sin;
      u.uTilt[2] = tilt.lean;
      u.uAmount = band.clouds;
      u.uCarried[0] = carriedBy(drifts[0]!, at);
      u.uCarried[1] = carriedBy(drifts[1]!, at);
      u.uCarried[2] = carriedBy(drifts[2]!, at);
      u.uClumps[0] = clumps.cell;
      u.uClumps[1] = clumps.around;
      u.uPatches[0] = patches.cell;
      u.uPatches[1] = patches.around;
      u.uWarp[0] = warp.cell;
      u.uWarp[1] = warp.around;
      u.uCover = tuning.cover;
      u.uPatchWeight = tuning.patches;
      u.uEdge = tuning.edge;
      u.uShadow = tuning.shadow * band.shadows;
      u.uReach = tuning.reach;
      u.uMagnify = band.magnification;
      u.uInside = band.inside;
      uniforms.update();

      const width = Math.max(1, Math.ceil(view.width * levelLook.resolution));
      const height = Math.max(1, Math.ceil(view.height * levelLook.resolution));
      if (target.width !== width || target.height !== height || target.source.resolution !== resolution) {
        target.resize(width, height, resolution);
      }
      const measuring = meter.start();
      renderer.render({ container: mesh, target, clear: true, clearColor: [0, 0, 0, 0] });
      if (measuring) meter.stop(true);
      sprite.visible = true;
      sprite.width = view.width;
      sprite.height = view.height;
      return still ? null : 1000 / levelLook.framesPerSecond;
    },

    destroy(): void {
      stopWatching();
      stopWatchingShaders();
      stopWatchingTuning();
      meter.dispose();
      sprite.destroy();
      target.destroy(true);
      mesh.destroy();
      shader.destroy();
    },
  };
}

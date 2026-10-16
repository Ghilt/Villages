import { GlProgram, Matrix, Shader, Texture, TextureStyle, UniformGroup } from 'pixi.js';
import type { Renderer, WebGLRenderer } from 'pixi.js';

import { groundTilt, tiltGround } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { note } from '../../log/log';
import { createCostMeter } from '../../shaders/costMeter';
import { drawnAt, shadersStore } from '../../shaders/levels';
import type { ShaderLevel } from '../../shaders/levels';
import type { Layer } from '../layer';
import { sceneryDrawn } from '../scenery/sceneryCells';
import { DOWN_WIND, gustsCarried, windTime } from '../wind';

import { TREES_LOOK, tintOf } from './look';
import { SWAY_FRAGMENT, swayVertex } from './swayShader';
import { treesStore } from './treesMode';
import { treesTuningStore } from './treesTuning';

/**
 * The trees in the wind, as a layer of the sprite canvas that draws nothing of its own: the scenery's sprites and
 * their shadows are drawn with its two shaders, and every frame it tells them where the camera is, how far the wind
 * has carried the gusts, and how far the Trees part's sliders say a gust bends a tree. While some of the scenery is
 * on the screen and its level is not off, it asks for frames at its level's rate, so the trees move on a map that
 * is otherwise still; and for none otherwise. A player who asked for less motion gets them standing still.
 *
 * A frame it asks for is the whole sprite canvas drawn again, so that is what it measures: the first time the trees
 * move at a level, the log says once what a frame of the canvas costs the graphics card then, timed there. Its
 * level is in the bar of the Trees part of the debug panel's Shaders section, under the switch over all of them.
 */

/** What the scenery is drawn with: a shader for its sprites and one for their shadows, and each kind's tint. */
export interface SceneryShaders {
  standing: Shader;
  shadows: Shader;
  tintOf(kind: string): number;
}

export interface TreesLayer extends Layer {
  shaders: SceneryShaders;
  /** Marks the start of a frame of the sprite canvas, when this one is to be measured: true when it is. */
  measure(): boolean;
  /** Marks its end, after a start that said true. */
  measured(measuring: boolean): void;
}

export function createTreesLayer(renderer: Renderer, repaint: () => void): TreesLayer {
  const uniforms = new UniformGroup({
    uTilt: { value: new Float32Array([1, 0, 1]), type: 'vec3<f32>' },
    uDownWind: { value: new Float32Array(2), type: 'vec2<f32>' },
    uCarried: { value: 0, type: 'f32' },
    uTime: { value: 0, type: 'f32' },
    uBend: { value: 0, type: 'f32' },
    uPale: { value: 0, type: 'f32' },
  });
  const shaderOf = (shadows: boolean): Shader =>
    new Shader({
      glProgram: GlProgram.from({
        vertex: swayVertex(shadows),
        fragment: SWAY_FRAGMENT,
        name: shadows ? 'scenery-shadows' : 'scenery',
      }),
      resources: {
        // The atlas and where the layer stands on the screen, which the particle container hands over as it draws.
        uTexture: Texture.WHITE.source,
        uSampler: new TextureStyle({}),
        uniforms: {
          uTranslationMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
          uColor: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
          uRound: { value: 0, type: 'f32' },
          uResolution: { value: [0, 0], type: 'vec2<f32>' },
        },
        swayUniforms: uniforms,
      },
    });
  const standing = shaderOf(false);
  const shadows = shaderOf(true);

  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // What each level costs, measured on the graphics card where it will say, and said once a level.
  const meter = createCostMeter((renderer as WebGLRenderer).gl as WebGL2RenderingContext | undefined);
  const measured = new Set<ShaderLevel>();
  let lastLevel: ShaderLevel | null = null;
  /** Whether the trees moved this frame, which is when a frame of the canvas is theirs to measure. */
  let swaying = false;

  const stopWatching = treesStore.watch(repaint);
  const stopWatchingShaders = shadersStore.watch(repaint);
  // A slider moved shows on the next frame even where nothing else is moving the map.
  const stopWatchingTuning = treesTuningStore.watch(repaint);

  return {
    shaders: { standing, shadows, tintOf },

    draw(view: CameraView): number | null {
      const level = drawnAt(treesStore.get().level);
      const ms = meter.read();
      if (ms !== null && lastLevel !== null && lastLevel !== 'off') {
        measured.add(lastLevel);
        const rate = TREES_LOOK.levels[lastLevel].framesPerSecond;
        note(
          'trees',
          `${lastLevel}, ${rate} frames a second: a frame of the sprite canvas with the trees in the wind takes ` +
            `${ms.toFixed(2)} ms of the graphics card, ${((ms * rate) / 10).toFixed(1)}% of its time`,
        );
      }
      const look = level === 'off' ? null : TREES_LOOK.levels[level];
      // The scenery is drawn before this in the stack, so this frame's tally is already in.
      swaying = look !== null && !still && sceneryDrawn().particles > 0;
      if (swaying && level !== lastLevel) {
        lastLevel = level;
        if (!measured.has(level)) meter.again();
      }
      const tilt = groundTilt(view);
      const down = tiltGround(DOWN_WIND.east, DOWN_WIND.south, tilt);
      const tuning = treesTuningStore.get();
      // By the wall clock, so every browser bends the same tree with the same gust: see ../wind.ts.
      const wall = Date.now();
      const u = uniforms.uniforms;
      u.uTilt[0] = tilt.cos;
      u.uTilt[1] = tilt.sin;
      u.uTilt[2] = tilt.lean;
      u.uDownWind[0] = down.x;
      u.uDownWind[1] = down.y;
      u.uCarried = gustsCarried(wall);
      u.uTime = windTime(wall);
      u.uBend = swaying ? tuning.bend : 0;
      u.uPale = swaying ? tuning.pale : 0;
      uniforms.update();
      return swaying && look !== null ? 1000 / look.framesPerSecond : null;
    },

    measure(): boolean {
      return swaying && meter.start();
    },

    measured(measuring: boolean): void {
      if (measuring) meter.stop(true);
    },

    destroy(): void {
      stopWatching();
      stopWatchingShaders();
      stopWatchingTuning();
      meter.dispose();
      standing.destroy();
      shadows.destroy();
    },
  };
}

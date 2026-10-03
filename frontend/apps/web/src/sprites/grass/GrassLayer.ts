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
import type { Renderer, WebGLRenderer } from 'pixi.js';

import { groundTilt, pixelsPerWorldUnit, toMercatorExact } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { classesOfTile, terrainPalette } from '../../geometry/terrainClasses';
import { FLAT_MAX_ZOOM, TILE, WORLD_MASTER_WIDTH } from '../../geometry/world';
import { note } from '../../log/log';
import type { Layer } from '../layer';

import { grassStore } from './grassMode';
import { grassMaskOf, sameRange, tilesUnder } from './grassMask';
import type { TileRange } from './grassMask';
import { GRASS_FRAGMENT, GRASS_VERTEX } from './grassShader';
import { GRASS_LOOK } from './look';

/**
 * WIP SPIKE: the grass, as a layer of the sprite canvas: under the scenery and the marks, and in the container
 * the fog takes the colour out of, so it is hazed and loses its colour exactly as the trees on it do.
 *
 * It is worked out at a part of the screen's size, `look.ts`'s resolution, into a picture of its own, which is
 * then laid over the whole screen: a half across and down is a quarter of the pixels. It asks for a frame fifteen
 * times a second while some of it is on the screen and swaying, and for none otherwise, so the sprite canvas
 * redraws for it and the map does not. The first time it has been drawn for a while it says once in the log
 * what it costs the graphics card, measured rather than guessed.
 */

/** One triangle that covers the screen, in clip space, so the fragment shader runs once for every pixel. */
const COVER = new Float32Array([-1, -1, 3, -1, -1, 3]);
const FRAME_MS = 1000 / GRASS_LOOK.framesPerSecond;
/** How many frames the cost is measured over before it is said. */
const MEASURED = 30;

const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

export interface GrassLayer extends Layer {
  /** The grass as it is drawn: a picture the size of the screen, to go under the scenery. */
  sprite: Sprite;
}

interface Mask {
  range: TileRange;
  root: string;
  source: BufferImageSource;
  grassy: number;
}

export function createGrassLayer(
  renderer: Renderer,
  tilesRoot: () => string,
  repaint: () => void,
): GrassLayer {
  const uniforms = new UniformGroup({
    uSize: { value: new Float32Array(2), type: 'vec2<f32>' },
    uCentre: { value: new Float32Array(2), type: 'vec2<f32>' },
    uScale: { value: 1, type: 'f32' },
    uTilt: { value: new Float32Array([1, 0, 1]), type: 'vec3<f32>' },
    uTime: { value: 0, type: 'f32' },
    uFade: { value: 0, type: 'f32' },
    uPixel: { value: 1, type: 'f32' },
    uMaskOrigin: { value: new Float32Array(2), type: 'vec2<f32>' },
    uMaskSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
  });
  const empty = new BufferImageSource({
    resource: new Uint8Array(4),
    width: 1,
    height: 1,
    format: 'r8unorm',
  });
  const shader = new Shader({
    glProgram: GlProgram.from({
      vertex: GRASS_VERTEX,
      fragment: GRASS_FRAGMENT,
      name: 'grass',
      // World units run to 32768, which a medium-precision float cannot place to within a unit.
      preferredFragmentPrecision: 'highp',
    }),
    resources: { grassUniforms: uniforms, uMask: empty },
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
  let mask: Mask | null = null;
  let wanted: { range: TileRange; root: string } | null = null;
  let grassIds: Set<number> | null = null;

  // The cost, measured on the graphics card where it will say, over the first frames the grass is drawn in.
  const gl = (renderer as WebGLRenderer).gl as WebGL2RenderingContext | undefined;
  const timer = gl?.getExtension('EXT_disjoint_timer_query_webgl2') ?? null;
  const timings: WebGLQuery[] = [];
  let said = false;

  const stopWatching = grassStore.watch(repaint);

  /** Pieces the mask for a range of tiles, and puts it in place unless the view has moved on meanwhile. */
  async function build(range: TileRange, root: string): Promise<void> {
    const palette = await terrainPalette();
    grassIds ??= new Set(
      palette.classes
        .filter((one) => (GRASS_LOOK.classes as readonly string[]).includes(one.name))
        .map((one) => one.id),
    );
    const asked: Promise<Uint8Array | null>[] = [];
    for (let y = range.fromY; y <= range.toY; y += 1) {
      for (let x = range.fromX; x <= range.toX; x += 1) {
        asked.push(classesOfTile(root, FLAT_MAX_ZOOM, x, y, palette));
      }
    }
    const tiles = await Promise.all(asked);
    if (wanted === null || !sameRange(wanted.range, range) || wanted.root !== root) {
      return;
    }
    const built = grassMaskOf(range, tiles, grassIds);
    const source = new BufferImageSource({
      resource: built.texels,
      width: built.width,
      height: built.height,
      format: 'r8unorm',
      scaleMode: 'linear',
      addressMode: 'clamp-to-edge',
      autoGenerateMipmaps: false,
    });
    const previous = mask?.source ?? null;
    mask = { range, root, source, grassy: built.grassy };
    shader.resources.uMask = source;
    previous?.destroy();
    uniforms.uniforms.uMaskOrigin[0] = range.fromX * TILE;
    uniforms.uniforms.uMaskOrigin[1] = range.fromY * TILE;
    uniforms.uniforms.uMaskSize[0] = built.width;
    uniforms.uniforms.uMaskSize[1] = built.height;
    uniforms.update();
    repaint();
  }

  /** Whether there is a mask to draw from, asking for the one the view needs when it is not the one held. */
  function maskFor(view: CameraView): Mask | null {
    const range = tilesUnder(view);
    const root = tilesRoot();
    if (range === null || root === '') {
      return null;
    }
    const held = mask !== null && sameRange(mask.range, range) && mask.root === root;
    const asking = wanted !== null && sameRange(wanted.range, range) && wanted.root === root;
    if (!held && !asking) {
      wanted = { range, root };
      void build(range, root);
    }
    // The old mask until the new one comes: it covers the part of the view it covers, and nothing else.
    return mask !== null && mask.root === root ? mask : null;
  }

  /** Says once what the grass costs, when the frames measured have all come back from the graphics card. */
  function sayCost(): void {
    if (said || gl === undefined || timer === null || timings.length < MEASURED) {
      return;
    }
    if (!timings.every((query) => gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) as boolean)) {
      return;
    }
    const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT) as boolean;
    const total = timings.reduce<number>(
      (sum, query) => sum + (gl.getQueryParameter(query, gl.QUERY_RESULT) as number),
      0,
    );
    for (const query of timings.splice(0)) gl.deleteQuery(query);
    if (disjoint) {
      return;
    }
    said = true;
    const ms = total / MEASURED / 1e6;
    note(
      'grass',
      `sways at ${Math.round(GRASS_LOOK.resolution ** 2 * 100)}% of the screen's pixels, ${GRASS_LOOK.framesPerSecond} ` +
        `frames a second: ${ms.toFixed(2)} ms of the graphics card a frame, ` +
        `${((ms * GRASS_LOOK.framesPerSecond) / 10).toFixed(1)}% of its time`,
    );
  }

  return {
    sprite,

    draw(view: CameraView, now: number): number | null {
      sayCost();
      const fade = smoothstep(GRASS_LOOK.fromZoom - 0.5, GRASS_LOOK.fromZoom + 0.5, view.zoom);
      const held = fade > 0 && grassStore.get().swaying ? maskFor(view) : null;
      if (held === null || held.grassy === 0) {
        sprite.visible = false;
        return null;
      }
      const centre = toMercatorExact(view.center);
      const tilt = groundTilt(view);
      const resolution = renderer.resolution;
      const u = uniforms.uniforms;
      u.uSize[0] = view.width;
      u.uSize[1] = view.height;
      u.uCentre[0] = centre.x * WORLD_MASTER_WIDTH;
      u.uCentre[1] = centre.y * WORLD_MASTER_WIDTH;
      u.uScale = pixelsPerWorldUnit(view.zoom);
      u.uTilt[0] = tilt.cos;
      u.uTilt[1] = tilt.sin;
      u.uTilt[2] = tilt.lean;
      u.uTime = still ? 0 : (now / 1000) % 3600;
      u.uFade = fade;
      u.uPixel = 1 / (GRASS_LOOK.resolution * resolution);
      uniforms.update();

      const width = Math.max(1, Math.ceil(view.width * GRASS_LOOK.resolution));
      const height = Math.max(1, Math.ceil(view.height * GRASS_LOOK.resolution));
      if (target.width !== width || target.height !== height || target.source.resolution !== resolution) {
        target.resize(width, height, resolution);
      }
      const timing =
        !said && timer !== null && gl !== undefined && timings.length < MEASURED ? gl.createQuery() : null;
      if (timing !== null) gl!.beginQuery(timer!.TIME_ELAPSED_EXT, timing);
      renderer.render({ container: mesh, target, clear: true, clearColor: [0, 0, 0, 0] });
      if (timing !== null) {
        gl!.endQuery(timer!.TIME_ELAPSED_EXT);
        timings.push(timing);
      }
      sprite.visible = true;
      sprite.width = view.width;
      sprite.height = view.height;
      return still ? null : FRAME_MS;
    },

    destroy(): void {
      stopWatching();
      for (const query of timings.splice(0)) gl?.deleteQuery(query);
      sprite.destroy();
      target.destroy(true);
      mesh.destroy();
      shader.destroy();
      mask?.source.destroy();
      empty.destroy();
    },
  };
}

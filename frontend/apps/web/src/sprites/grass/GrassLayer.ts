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
import { createCostMeter } from '../../shaders/costMeter';
import { drawnAt, sayLevel, shadersStore } from '../../shaders/levels';
import type { ShaderLevel } from '../../shaders/levels';
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
 * It is worked out into a picture of its own at its level's share of the screen's size, then laid over the whole
 * screen: low is a half across and down, a quarter of the pixels, high is all of them. It asks for frames at its
 * level's rate while some of it is on the screen, and for none otherwise, so the sprite canvas redraws for it and
 * the map does not. The first time it is drawn at a level it says once in the log what that costs the graphics
 * card, measured rather than guessed. Its level is in the bar of the Grass part of the debug panel's Shaders
 * section, under the switch over all of them.
 */

/** One triangle that covers the screen, in clip space, so the fragment shader runs once for every pixel. */
const COVER = new Float32Array([-1, -1, 3, -1, -1, 3]);

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

  // What each level costs, measured on the graphics card where it will say, and said once a level.
  const meter = createCostMeter((renderer as WebGLRenderer).gl as WebGL2RenderingContext | undefined);
  const measured = new Set<ShaderLevel>();
  let lastLevel: ShaderLevel | null = null;

  const stopWatching = grassStore.watch(repaint);
  const stopWatchingShaders = shadersStore.watch(repaint);

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

  return {
    sprite,

    draw(view: CameraView, now: number): number | null {
      const level = drawnAt(grassStore.get().level);
      const ms = meter.read();
      if (ms !== null && lastLevel !== null && lastLevel !== 'off') {
        measured.add(lastLevel);
        const look = GRASS_LOOK.levels[lastLevel];
        const share = ((ms * look.framesPerSecond) / 10).toFixed(1);
        note(
          'grass',
          `${sayLevel(lastLevel, look)}: ${ms.toFixed(2)} ms of the graphics card a frame, ${share}% of its time`,
        );
      }
      const fade = smoothstep(GRASS_LOOK.fromZoom - 0.5, GRASS_LOOK.fromZoom + 0.5, view.zoom);
      const held = fade > 0 && level !== 'off' ? maskFor(view) : null;
      if (level === 'off' || held === null || held.grassy === 0) {
        sprite.visible = false;
        return null;
      }
      const levelLook = GRASS_LOOK.levels[level];
      if (level !== lastLevel) {
        lastLevel = level;
        if (!measured.has(level)) meter.again();
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
      u.uPixel = 1 / (levelLook.resolution * resolution);
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
      meter.dispose();
      sprite.destroy();
      target.destroy(true);
      mesh.destroy();
      shader.destroy();
      mask?.source.destroy();
      empty.destroy();
    },
  };
}

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
import { gustsCarried, windTime } from '../wind';

import { CHANNELS_IN_FIRST, DRAWN, channelOf, landMaskOf, sameRange, tilesUnder } from './landMask';
import type { TileRange } from './landMask';
import { landStore } from './landMode';
import { LAND_FRAGMENT, LAND_VERTEX } from './landShader';
import { LAND_LOOK, lookOf, motionOf } from './look';
import { createMotionUniforms } from './motionUniforms';

/**
 * The land moving in the wind and the light, one layer for every kind of land, as a layer of the sprite canvas:
 * under the scenery and the marks, and in the container the fog takes the colour out of, so it is hazed and loses
 * its colour exactly as the trees on it do. What moves on each kind of land is the table in `look.ts`; the mask says
 * which world unit has which (`landMask.ts`), and the shader works out only those motions there (`landShader.ts`).
 * See decision record 0102.
 *
 * It is worked out into a picture of its own at its level's share of the screen's size, then laid over the whole
 * screen: low is a half across and down, a quarter of the pixels, high is all of them. It asks for frames at its
 * level's rate while some land that moves is on the screen, and for none otherwise, so the sprite canvas redraws for
 * it and the map does not. The first time it is drawn at a level it says once in the log what that costs the
 * graphics card, measured rather than guessed. Its level is in the bar of the Land part of the debug panel's Shaders
 * section, under the switch over all of them, and each motion's box in a fold of its own inside it.
 */

/** One triangle that covers the screen, in clip space, so the fragment shader runs once for every pixel. */
const COVER = new Float32Array([-1, -1, 3, -1, -1, 3]);

const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

export interface LandLayer extends Layer {
  /** The land as it is drawn: a picture the size of the screen, to go under the scenery. */
  sprite: Sprite;
}

/**
 * Where the land layer reads what each world unit is: a flat tile of class ids, by the tiles root it is asked for and
 * the tile's column and row at the deepest zoom, null for one that is not there. The map's own tiles, unless a page
 * with a world of its own - the renders page's squares - hands it another.
 */
export type ClassTiles = (root: string, x: number, y: number) => Promise<Uint8Array | null>;

const servedTiles: ClassTiles = async (root, x, y) =>
  classesOfTile(root, FLAT_MAX_ZOOM, x, y, await terrainPalette());

interface Mask {
  range: TileRange;
  root: string;
  source: BufferImageSource;
  /** The fifth motion's channel, a byte a world unit. */
  more: BufferImageSource;
  /** Which look of its motion each world unit's land has. */
  looks: BufferImageSource;
  /** How many world units of the mask have each channel's motion. */
  counts: readonly number[];
}

export function createLandLayer(
  renderer: Renderer,
  tilesRoot: () => string,
  repaint: () => void,
  tilesOf: ClassTiles = servedTiles,
): LandLayer {
  const uniforms = new UniformGroup({
    uSize: { value: new Float32Array(2), type: 'vec2<f32>' },
    uCentre: { value: new Float32Array(2), type: 'vec2<f32>' },
    uScale: { value: 1, type: 'f32' },
    uTilt: { value: new Float32Array([1, 0, 1]), type: 'vec3<f32>' },
    uTime: { value: 0, type: 'f32' },
    uCarried: { value: 0, type: 'f32' },
    uFade: { value: 0, type: 'f32' },
    uPixel: { value: 1, type: 'f32' },
    uMaskOrigin: { value: new Float32Array(2), type: 'vec2<f32>' },
    uMaskSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uShown: { value: new Float32Array(4), type: 'vec4<f32>' },
    uShownMore: { value: 0, type: 'f32' },
  });
  const motions = createMotionUniforms();
  const empty = new BufferImageSource({
    resource: new Uint8Array(4),
    width: 1,
    height: 1,
    format: 'rgba8unorm',
  });
  const noLooks = new BufferImageSource({
    resource: new Uint8Array(1),
    width: 1,
    height: 1,
    format: 'r8unorm',
  });
  // A placeholder of its own: one shared by two samplers is bound to only one of them.
  const noMore = new BufferImageSource({
    resource: new Uint8Array(1),
    width: 1,
    height: 1,
    format: 'r8unorm',
  });
  const shader = new Shader({
    glProgram: GlProgram.from({
      vertex: LAND_VERTEX,
      fragment: LAND_FRAGMENT,
      name: 'land',
      // World units run to 32768, which a medium-precision float cannot place to within a unit.
      preferredFragmentPrecision: 'highp',
    }),
    resources: {
      landUniforms: uniforms,
      ...motions.groups,
      uMask: empty,
      uMaskMore: noMore,
      uLooks: noLooks,
    },
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
  // The channel of the mask each class of the palette is drawn in, by its id; null for land the layer leaves alone.
  let channels: (number | null)[] | null = null;
  let looks: number[] | null = null;

  // What each level costs, measured on the graphics card where it will say, and said once a level.
  const meter = createCostMeter((renderer as WebGLRenderer).gl as WebGL2RenderingContext | undefined);
  const measured = new Set<ShaderLevel>();
  let lastLevel: ShaderLevel | null = null;

  const stopWatching = landStore.watch(repaint);
  const stopWatchingShaders = shadersStore.watch(repaint);
  const stopWatchingMotions = motions.watch(repaint);

  /** Pieces the mask for a range of tiles, and puts it in place unless the view has moved on meanwhile. */
  async function build(range: TileRange, root: string): Promise<void> {
    const palette = await terrainPalette();
    if (channels === null) {
      const ofIds = new Array<number | null>(256).fill(null);
      for (const one of palette.classes) ofIds[one.id] = channelOf(motionOf(one.name));
      channels = ofIds;
      const looksOf = new Array<number>(256).fill(0);
      for (const one of palette.classes) looksOf[one.id] = lookOf(one.name);
      looks = looksOf;
    }
    const asked: Promise<Uint8Array | null>[] = [];
    for (let y = range.fromY; y <= range.toY; y += 1) {
      for (let x = range.fromX; x <= range.toX; x += 1) {
        asked.push(tilesOf(root, x, y));
      }
    }
    const tiles = await Promise.all(asked);
    if (wanted === null || !sameRange(wanted.range, range) || wanted.root !== root) {
      return;
    }
    const built = landMaskOf(range, tiles, channels, looks ?? []);
    const source = new BufferImageSource({
      resource: built.texels,
      width: built.width,
      height: built.height,
      format: 'rgba8unorm',
      // Four channels of their own, not a colour: multiplied by the fourth on the way up, the other three would be lost.
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      addressMode: 'clamp-to-edge',
      autoGenerateMipmaps: false,
    });
    const moreSource = new BufferImageSource({
      resource: built.more,
      width: built.width,
      height: built.height,
      format: 'r8unorm',
      scaleMode: 'linear',
      addressMode: 'clamp-to-edge',
      autoGenerateMipmaps: false,
    });
    // Read as they are, a look a texel, never blended between two.
    const lookSource = new BufferImageSource({
      resource: built.looks,
      width: built.width,
      height: built.height,
      format: 'r8unorm',
      scaleMode: 'nearest',
      addressMode: 'clamp-to-edge',
      autoGenerateMipmaps: false,
    });
    const previous = mask;
    mask = { range, root, source, more: moreSource, looks: lookSource, counts: built.counts };
    shader.resources.uMask = source;
    shader.resources.uMaskMore = moreSource;
    shader.resources.uLooks = lookSource;
    previous?.source.destroy();
    previous?.more.destroy();
    previous?.looks.destroy();
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

    draw(view: CameraView): number | null {
      const { level: own, shown } = landStore.get();
      const level = drawnAt(own);
      const ms = meter.read();
      if (ms !== null && lastLevel !== null && lastLevel !== 'off') {
        measured.add(lastLevel);
        const look = LAND_LOOK.levels[lastLevel];
        const share = ((ms * look.framesPerSecond) / 10).toFixed(1);
        note(
          'land',
          `${sayLevel(lastLevel, look)}: ${ms.toFixed(2)} ms of the graphics card a frame, ${share}% of its time`,
        );
      }
      const fade = smoothstep(LAND_LOOK.fromZoom - 0.5, LAND_LOOK.fromZoom + 0.5, view.zoom);
      const held = fade > 0 && level !== 'off' ? maskFor(view) : null;
      // Only the motions shown that the land under the view has: with none, nothing is drawn or asked for.
      const moving = DRAWN.map((motion, channel) => shown[motion] && (held?.counts[channel] ?? 0) > 0);
      if (level === 'off' || held === null || !moving.includes(true)) {
        sprite.visible = false;
        return null;
      }
      const levelLook = LAND_LOOK.levels[level];
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
      // By the wall clock, so every browser has the same gusts: see ../wind.ts.
      const wall = Date.now();
      u.uTime = still ? 0 : windTime(wall);
      u.uCarried = still ? 0 : gustsCarried(wall);
      u.uFade = fade;
      u.uPixel = 1 / (levelLook.resolution * resolution);
      for (let channel = 0; channel < CHANNELS_IN_FIRST; channel += 1)
        u.uShown[channel] = moving[channel] === true ? 1 : 0;
      u.uShownMore = moving[CHANNELS_IN_FIRST] === true ? 1 : 0;
      uniforms.update();
      motions.tune(wall, still);

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
      stopWatchingMotions();
      meter.dispose();
      sprite.destroy();
      target.destroy(true);
      mesh.destroy();
      shader.destroy();
      mask?.source.destroy();
      mask?.more.destroy();
      mask?.looks.destroy();
      empty.destroy();
      noLooks.destroy();
      noMore.destroy();
    },
  };
}

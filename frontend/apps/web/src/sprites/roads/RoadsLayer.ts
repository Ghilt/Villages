import {
  Buffer,
  BufferUsage,
  Geometry,
  GlProgram,
  Mesh,
  RenderTexture,
  Shader,
  Sprite,
  UniformGroup,
} from 'pixi.js';
import type { Renderer } from 'pixi.js';

import type { RoadsMapFile } from '@villages/world';

import { standingLayer } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { note } from '../../log/log';
import { heldStandsOf, onStandsArrived, onStandsFollowed } from '../../net/stands';
import { piecesHeld, roadsMap } from '../ground/roads';
import { workedGroundStore } from '../ground/settings';
import type { Layer } from '../layer';
import { BECOMES_A_MARK_AT } from '../twoForms';
import { stripsOf } from './roadStrips';
import type { RoadStrip } from './roadStrips';
import { ROAD_FRAGMENT, ROAD_VERTEX } from './roadShader';

/*
 * The roads, drawn as shapes over the ground: every piece of the `roads` layer the page holds, cut to the ground the
 * house has revealed (`roadStrips.ts`), each stretch a soft band with round ends (`roadShader.ts`), all of them in one
 * draw into a picture the size of the screen, which stands over the worn ground and under everything standing on it, in
 * the container the fog takes the colour out of. From zoom 6, where the records first come, a thin line; from 7.5 in,
 * packed earth as wide as its grade. A bridge is a line only further out than its picture. No tree grows on a road:
 * the worked ground keeps its diamonds clear (`ground/roads.ts`). See docs/plans/houses-bridges-and-road-render.md.
 */

export interface RoadsLayer extends Layer {
  sprite: Sprite;
  /** Where the ground is revealed, for where a road stops: null with the fog off. */
  setRevealed(revealed: ((x: number, y: number) => boolean) | null): void;
  /** The folder of the master's world, for its roads map. */
  setTilesRoot(tilesRoot: string): void;
  /** How many stretches are held to draw. */
  report(): { strips: number };
}

/** The zoom the roads first show at, where their records first come, and how far they take to come in. */
const FROM_ZOOM = 6;
const COMING_IN = 0.3;
/** A bridge's stretch is drawn with this added to its grade, so the shader can let it go where its picture stands. */
const BRIDGE = 10;
/** How many floats each corner of a stretch's quad carries: its ends, its corner, its half-width and grade. */
const FLOATS = 8;

const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

function channelsOf(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** The stretches as one geometry, their ends measured from `origin`. */
function geometryOf(strips: readonly RoadStrip[], origin: { x: number; y: number }): Geometry {
  const data = new Float32Array(strips.length * 4 * FLOATS);
  const indices = new Uint32Array(strips.length * 6);
  strips.forEach((strip, at) => {
    const corners: [number, number][] = [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ];
    corners.forEach(([along, across], corner) => {
      data.set(
        [
          strip.ax - origin.x,
          strip.ay - origin.y,
          strip.bx - origin.x,
          strip.by - origin.y,
          along,
          across,
          strip.half,
          strip.grade + (strip.bridge ? BRIDGE : 0),
        ],
        (at * 4 + corner) * FLOATS,
      );
    });
    const first = at * 4;
    indices.set([first, first + 1, first + 2, first, first + 2, first + 3], at * 6);
  });
  const buffer = new Buffer({ data, usage: BufferUsage.VERTEX });
  const stride = FLOATS * 4;
  return new Geometry({
    attributes: {
      aEnds: { buffer, format: 'float32x4', stride, offset: 0 },
      aCorner: { buffer, format: 'float32x2', stride, offset: 16 },
      aHow: { buffer, format: 'float32x2', stride, offset: 24 },
    },
    indexBuffer: indices,
  });
}

export function createRoadsLayer(renderer: Renderer, repaint: () => void): RoadsLayer {
  const uniforms = new UniformGroup({
    uSize: { value: new Float32Array(2), type: 'vec2<f32>' },
    uRowX: { value: new Float32Array(3), type: 'vec3<f32>' },
    uRowY: { value: new Float32Array(3), type: 'vec3<f32>' },
    uPixel: { value: 1, type: 'f32' },
    uOrigin: { value: new Float32Array(2), type: 'vec2<f32>' },
    uRoad: { value: new Float32Array(3), type: 'vec3<f32>' },
    uNear: { value: 0, type: 'f32' },
    uBridges: { value: 1, type: 'f32' },
  });
  const shader = new Shader({
    glProgram: GlProgram.from({
      vertex: ROAD_VERTEX,
      fragment: ROAD_FRAGMENT,
      name: 'roads',
      preferredVertexPrecision: 'highp',
      preferredFragmentPrecision: 'highp',
    }),
    resources: { roadUniforms: uniforms },
  });
  const target = RenderTexture.create({ width: 1, height: 1, dynamic: true, scaleMode: 'linear' });
  const sprite = new Sprite(target);
  sprite.visible = false;

  let mesh: Mesh<Geometry, Shader> | null = null;
  let origin = { x: 0, y: 0 };
  let strips: RoadStrip[] = [];
  let revealed: ((x: number, y: number) => boolean) | null = null;
  let widths: RoadsMapFile['widths'] | null = null;
  let tilesRoot: string | null = null;
  let stale = true;
  let said = -1;
  const dirty = () => {
    stale = true;
    repaint();
  };
  const stopArriving = onStandsArrived((_, __, layer) => layer === 'roads' && dirty());
  const stopFollowing = onStandsFollowed(dirty);
  const stopWatching = workedGroundStore.watch(dirty);

  function rebuild(): void {
    const pieces = piecesHeld(
      [...heldStandsOf('roads')].flatMap((tile) => (tile.roads === undefined ? [] : [tile.roads])),
    );
    strips = widths === null ? [] : stripsOf(pieces, widths, workedGroundStore.get().roadWidth, revealed);
    const first = strips[0];
    origin = first === undefined ? { x: 0, y: 0 } : { x: Math.floor(first.ax), y: Math.floor(first.ay) };
    mesh?.geometry.destroy(true);
    mesh?.destroy();
    mesh = strips.length === 0 ? null : new Mesh({ geometry: geometryOf(strips, origin), shader });
    if (strips.length !== said) {
      said = strips.length;
      note('roads', `${strips.length} stretches of road drawn as shapes, from zoom ${FROM_ZOOM}`);
    }
  }

  return {
    sprite,

    setRevealed(next): void {
      if (next === revealed) return;
      revealed = next;
      dirty();
    },

    setTilesRoot(next: string): void {
      if (next === tilesRoot) return;
      tilesRoot = next;
      widths = null;
      void roadsMap(next).then((file) => {
        if (tilesRoot !== next) return;
        widths = file?.widths ?? null;
        dirty();
      });
    },

    report: () => ({ strips: strips.length }),

    draw(view: CameraView): number | null {
      const { on, strength, road } = workedGroundStore.get();
      const appear = smoothstep(FROM_ZOOM - 0.1, FROM_ZOOM + COMING_IN, view.zoom);
      if (stale) {
        rebuild();
        stale = false;
      }
      if (!on || appear === 0 || mesh === null) {
        sprite.visible = false;
        return null;
      }
      const { scale, x, y, tilt } = standingLayer(view);
      const u = uniforms.uniforms;
      u.uSize[0] = view.width;
      u.uSize[1] = view.height;
      u.uRowX[0] = scale * tilt.cos;
      u.uRowX[1] = scale * tilt.sin;
      u.uRowX[2] = scale * (tilt.cos * origin.x + tilt.sin * origin.y) + x;
      u.uRowY[0] = -scale * tilt.sin * tilt.lean;
      u.uRowY[1] = scale * tilt.cos * tilt.lean;
      u.uRowY[2] = scale * (tilt.cos * origin.y - tilt.sin * origin.x) * tilt.lean + y;
      u.uPixel = 1 / scale;
      u.uOrigin[0] = origin.x;
      u.uOrigin[1] = origin.y;
      const [red, green, blue] = channelsOf(road);
      u.uRoad[0] = red;
      u.uRoad[1] = green;
      u.uRoad[2] = blue;
      u.uNear = smoothstep(BECOMES_A_MARK_AT - 0.5, BECOMES_A_MARK_AT + 0.5, view.zoom);
      // Where a bridge's picture comes in, its line goes.
      u.uBridges = 1 - smoothstep(BECOMES_A_MARK_AT, BECOMES_A_MARK_AT + 0.5, view.zoom);
      uniforms.update();

      const resolution = renderer.resolution;
      const width = Math.max(1, Math.ceil(view.width));
      const height = Math.max(1, Math.ceil(view.height));
      if (target.width !== width || target.height !== height || target.source.resolution !== resolution) {
        target.resize(width, height, resolution);
      }
      renderer.render({ container: mesh, target, clear: true, clearColor: [0, 0, 0, 0] });
      sprite.visible = true;
      sprite.alpha = appear * Math.min(1, strength + 0.1);
      sprite.width = view.width;
      sprite.height = view.height;
      return null;
    },

    destroy(): void {
      stopArriving();
      stopFollowing();
      stopWatching();
      mesh?.geometry.destroy(true);
      mesh?.destroy();
      sprite.destroy();
      target.destroy(true);
      shader.destroy();
    },
  };
}

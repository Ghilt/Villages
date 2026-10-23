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
import type { Container, Renderer, WebGLRenderer } from 'pixi.js';

import type { RoadsMapFile } from '@villages/world';

import { standingLayer } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { note } from '../../log/log';
import { programsAhead } from '../../shaders/compileAhead';
import { onStandsArrived, onStandsFollowed, standsVersion } from '../../net/stands';
import { roadsHeld, roadsMap } from '../ground/roads';
import { workedGroundStore } from '../ground/settings';
import type { Worked } from '../ground/worked';
import { createArrival } from '../arrival';
import type { Layer } from '../layer';
import { soonest } from '../layer';
import type { SettlementPictures } from '../settlements/settlementPictures';
import { createRoadsideLayer } from './RoadsideLayer';
import { stripsOf } from './roadStrips';
import type { RoadStrip } from './roadStrips';
import { ROAD_FRAGMENT, ROAD_VERTEX } from './roadShader';

/*
 * The roads, drawn as shapes over the ground: every piece of the `roads` layer the page holds, cut to the ground the
 * house has revealed (`roadStrips.ts`), each stretch a soft band with round ends (`roadShader.ts`), all of them in one
 * draw into a picture the size of the screen, which stands over the worn ground and under everything standing on it, in
 * the container the fog takes the colour out of: packed earth as wide as its grade. A road is the real world, so it
 * arrives with the scenery and the structures at 7.5 and fades in time (`arrival.ts`); where a bridge carries it,
 * the bridge's picture is the road. No tree grows on a road: the worked ground keeps its diamonds clear
 * (`ground/roads.ts`). See docs/plans/houses-bridges-and-road-render.md and decision record 0096.
 */

export interface RoadsLayer extends Layer {
  sprite: Sprite;
  /** The roadside along the roads, over them and under everything standing (`RoadsideLayer.ts`). */
  roadside: Container;
  /** The worked ground, whose wayside the roadside stands on. */
  setWorked(worked: ReadonlyMap<number, Worked>): void;
  /** Where the ground is revealed, for where a road stops: null with the fog off. */
  setRevealed(revealed: ((x: number, y: number) => boolean) | null): void;
  /** The folder of the master's world, for its roads map. */
  setTilesRoot(tilesRoot: string): void;
  /** How many stretches are held to draw. */
  report(): { strips: number; roadside: number };
  /** Hands their program to the graphics driver now, if it has not been already. */
  compileAhead(): void;
}

/** How many floats each corner of a stretch's quad carries: its ends, its corner, its half-width and grade. */
const FLOATS = 8;

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
          strip.grade,
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

export function createRoadsLayer(
  renderer: Renderer,
  repaint: () => void,
  pictures: SettlementPictures,
): RoadsLayer {
  const roadside = createRoadsideLayer(pictures, repaint);
  const uniforms = new UniformGroup({
    uSize: { value: new Float32Array(2), type: 'vec2<f32>' },
    uRowX: { value: new Float32Array(3), type: 'vec3<f32>' },
    uRowY: { value: new Float32Array(3), type: 'vec3<f32>' },
    uPixel: { value: 1, type: 'f32' },
    uOrigin: { value: new Float32Array(2), type: 'vec2<f32>' },
    uRoad: { value: new Float32Array(3), type: 'vec3<f32>' },
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
  // Drawn only once the driver has compiled their program, so the page never waits on it (`programsAhead`).
  const ahead = programsAhead(
    (renderer as WebGLRenderer).gl as WebGL2RenderingContext | undefined,
    [shader],
    (ms) =>
      note(
        'roads',
        ms === null
          ? "this browser cannot compile the roads' program ahead, so its first draw waits on the driver"
          : `the roads' program compiled ahead in ${(ms / 1000).toFixed(1)} s, the page never waiting`,
      ),
    repaint,
  );
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
  /** The version of the `roads` layer the stretches were worked out from: worked out again only when it moves. */
  let readVersion = -1;
  let said = -1;
  const arrival = createArrival();
  const dirty = () => {
    stale = true;
    repaint();
  };
  const stopArriving = onStandsArrived((_, __, layer) => layer === 'roads' && repaint());
  const stopFollowing = onStandsFollowed(repaint);
  const stopWatching = workedGroundStore.watch(dirty);

  function rebuild(): void {
    const pieces = roadsHeld();
    strips =
      widths === null
        ? []
        : stripsOf(pieces, widths, workedGroundStore.get().roadWidth, revealed).filter((one) => !one.bridge);
    const first = strips[0];
    origin = first === undefined ? { x: 0, y: 0 } : { x: Math.floor(first.ax), y: Math.floor(first.ay) };
    mesh?.geometry.destroy(true);
    mesh?.destroy();
    mesh = strips.length === 0 ? null : new Mesh({ geometry: geometryOf(strips, origin), shader });
    if (strips.length !== said) {
      said = strips.length;
      note('roads', `${strips.length} stretches of road drawn as shapes, with the real world from zoom 7.5`);
    }
  }

  return {
    sprite,
    roadside: roadside.container,

    setWorked: (worked) => roadside.setWorked(worked),

    setRevealed(next): void {
      if (next === revealed) return;
      revealed = next;
      dirty();
    },

    setTilesRoot(next: string): void {
      roadside.setTilesRoot(next);
      if (next === tilesRoot) return;
      tilesRoot = next;
      widths = null;
      void roadsMap(next).then((file) => {
        if (tilesRoot !== next) return;
        widths = file?.widths ?? null;
        dirty();
      });
    },

    report: () => ({ strips: strips.length, roadside: roadside.report().items }),

    draw(view: CameraView, now: number, elapsed: number): number | null {
      const besides = roadside.draw(view, now, elapsed);
      const { on, strength, road } = workedGroundStore.get();
      const appear = arrival.step(view.zoom, elapsed);
      const version = standsVersion('roads');
      if (stale || version !== readVersion) {
        rebuild();
        stale = false;
        readVersion = version;
      }
      if (on && appear > 0 && mesh !== null) ahead.begin();
      if (!on || appear === 0 || mesh === null || !ahead.ready()) {
        sprite.visible = false;
        return soonest(besides, arrival.wants());
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
      return soonest(besides, arrival.wants());
    },

    compileAhead: () => ahead.begin(),

    destroy(): void {
      ahead.stop();
      roadside.destroy();
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

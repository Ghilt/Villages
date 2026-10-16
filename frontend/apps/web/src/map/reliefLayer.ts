import type * as maplibregl from 'maplibre-gl';
import { MercatorCoordinate } from 'maplibre-gl';
import { HEIGHT_MAX_ZOOM } from '@villages/world';
import type { Lattice } from '@villages/world';

import { note } from '../log/log';
import { linkProgram, unitQuad } from '../shaders/webgl';

import { LIGHT_COLOUR, SHADE_COLOUR } from './light';
import { RELIEF_FRAGMENT, RELIEF_VERTEX } from './reliefShader';
import { createReliefTiles } from './reliefTiles';
import type { TileRange } from './reliefTiles';

/**
 * The relief drawn by a shader of our own (decision record 0090), a MapLibre custom layer beside MapLibre's own
 * hillshade, to compare: the same height tiles, worked out for every pixel, or with pixels on for every cell of
 * the lattice the painted renderers draw on. Everything it is told is a uniform, so every lever is live.
 */

export const OUR_RELIEF_LAYER = 'relief-ours';

/** What the layer draws with at a zoom, read every frame. */
export interface ReliefLook {
  pixels: boolean;
  tones: number;
  exaggeration: number;
  gain: number;
  shade: number;
  light: number;
  /** Towards the light, east, north and up. */
  sun: readonly [number, number, number];
  lattice: Lattice;
}

const UNIFORMS = [
  'uMatrix',
  'uQuad',
  'uTile',
  'uHeights',
  'uLattice',
  'uPixels',
  'uTones',
  'uExaggeration',
  'uGain',
  'uAlpha',
  'uSun',
  'uShadeColour',
  'uLightColour',
] as const;

/** A height tile: its zoom, and its column and row from the north-west. */
interface Tile {
  z: number;
  x: number;
  y: number;
}

function linked(gl: WebGL2RenderingContext) {
  return { ...linkProgram(gl, RELIEF_VERTEX, RELIEF_FRAGMENT, UNIFORMS, 'relief'), ...unitQuad(gl) };
}

export function createReliefLayer(
  worldRoot: string,
  look: (zoom: number) => ReliefLook,
): maplibregl.CustomLayerInterface {
  let map: maplibregl.Map | null = null;
  let drawing: ReturnType<typeof linked> | null = null;
  const tiles = createReliefTiles(worldRoot, () => map?.triggerRepaint());

  /** The tiles of a zoom the view covers, from its four corners, which a tipped camera needs. */
  const inView = (z: number): TileRange => {
    const across = 2 ** z;
    const canvas = map!.getCanvas();
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [x, y] of [
      [0, 0],
      [canvas.clientWidth, 0],
      [0, canvas.clientHeight],
      [canvas.clientWidth, canvas.clientHeight],
    ] as const) {
      const ground = MercatorCoordinate.fromLngLat(map!.unproject([x, y]));
      xs.push(ground.x);
      ys.push(ground.y);
    }
    const clamp = (value: number) => Math.min(across - 1, Math.max(0, Math.floor(value * across)));
    return {
      z,
      fromX: clamp(Math.min(...xs)),
      toX: clamp(Math.max(...xs)),
      fromY: clamp(Math.min(...ys)),
      toY: clamp(Math.max(...ys)),
    };
  };

  /**
   * While a tile is on its way, what stands in for it: its four children where all of them are here, as they are
   * just after zooming out; else the nearest coarser tile that is here, a part of it, softer but the same ground;
   * else whichever children are. Never more than one layer of shade on a place, so never darker for it.
   */
  const standIn = (
    gl: WebGL2RenderingContext,
    tile: Tile,
    draw: (texture: WebGLTexture, quad: Tile, from: Tile) => void,
  ) => {
    const children: [WebGLTexture | null, Tile][] = [];
    if (tile.z < HEIGHT_MAX_ZOOM) {
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const) {
        const child = { z: tile.z + 1, x: tile.x * 2 + dx, y: tile.y * 2 + dy };
        children.push([tiles.drawable(gl, child.z, child.x, child.y), child]);
      }
    }
    if (children.length === 0 || children.some(([texture]) => texture === null)) {
      for (let up = 1; up <= tile.z; up += 1) {
        const parent = { z: tile.z - up, x: tile.x >> up, y: tile.y >> up };
        const texture = tiles.drawable(gl, parent.z, parent.x, parent.y);
        if (texture !== null) {
          draw(texture, tile, parent);
          return;
        }
      }
    }
    for (const [texture, child] of children) {
      if (texture !== null) {
        draw(texture, child, child);
      }
    }
  };

  return {
    id: OUR_RELIEF_LAYER,
    type: 'custom',
    renderingMode: '2d',

    onAdd(added, context) {
      map = added;
      try {
        drawing = linked(context as WebGL2RenderingContext);
      } catch (error) {
        note(
          'relief',
          `our relief could not be drawn: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },

    render(context, options) {
      const gl = context as WebGL2RenderingContext;
      if (drawing === null || map === null) {
        return;
      }
      const zoom = map.getZoom();
      const now = look(zoom);
      if (now.shade <= 0 && now.light <= 0) {
        // Nothing to draw at this zoom, so nothing asked for either, and whatever was on its way is let go of.
        tiles.want(null);
        return;
      }
      // A height tile drawn at between one and two times its own size, as MapLibre picks its tiles.
      const z = Math.max(0, Math.min(HEIGHT_MAX_ZOOM, Math.floor(zoom + 1)));
      const view = inView(z);
      tiles.want(view);
      const { where } = drawing;

      gl.useProgram(drawing.program);
      gl.bindVertexArray(drawing.vao);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.STENCIL_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniformMatrix4fv(where.uMatrix, false, options.defaultProjectionData.mainMatrix);
      gl.uniform1i(where.uHeights, 0);
      const turn = (now.lattice.turn * Math.PI) / 180;
      gl.uniform3f(where.uLattice, Math.cos(turn), Math.sin(turn), now.lattice.size);
      gl.uniform1i(where.uPixels, now.pixels ? 1 : 0);
      gl.uniform1f(where.uTones, now.tones);
      gl.uniform1f(where.uExaggeration, now.exaggeration);
      gl.uniform1f(where.uGain, now.gain);
      gl.uniform2f(where.uAlpha, now.shade, now.light);
      gl.uniform3f(where.uSun, ...now.sun);
      gl.uniform3f(where.uShadeColour, ...SHADE_COLOUR);
      gl.uniform3f(where.uLightColour, ...LIGHT_COLOUR);

      /** Draws the square of tile `quad` from the heights of tile `from`, itself or one that holds it. */
      const draw = (texture: WebGLTexture, quad: Tile, from: Tile) => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform3f(where.uQuad, quad.x / 2 ** quad.z, quad.y / 2 ** quad.z, 1 / 2 ** quad.z);
        gl.uniform3f(where.uTile, from.x / 2 ** from.z, from.y / 2 ** from.z, 1 / 2 ** from.z);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };

      for (let y = view.fromY; y <= view.toY; y += 1) {
        for (let x = view.fromX; x <= view.toX; x += 1) {
          const tile = { z, x, y };
          const own = tiles.drawable(gl, z, x, y);
          if (own !== null) {
            draw(own, tile, tile);
          } else {
            standIn(gl, tile, draw);
          }
        }
      }
      gl.bindVertexArray(null);
      if (tiles.forget(gl)) {
        map.triggerRepaint();
      }
    },

    onRemove(_removed, context) {
      const gl = context as WebGL2RenderingContext;
      tiles.dispose(gl);
      if (drawing !== null) {
        gl.deleteProgram(drawing.program);
        gl.deleteBuffer(drawing.buffer);
        gl.deleteVertexArray(drawing.vao);
      }
      map = null;
    },
  };
}

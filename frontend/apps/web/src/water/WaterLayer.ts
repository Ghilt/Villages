import type * as maplibregl from 'maplibre-gl';
import { MercatorCoordinate } from 'maplibre-gl';

import { note } from '../log/log';
import { pixelsPerWorldUnit } from '../geometry/cameraMath';
import { FLAT_MAX_ZOOM } from '../geometry/world';

import { flowFilesOf } from './flowFiles';
import { FLOW } from './flowShader';
import { createFlowView } from './flowView';
import type { TileRange } from './flowView';
import { WATER_LOOK } from './look';
import { createMaskTiles } from './maskTiles';
import { begin, link, quadOf, smoothstep, textureOf, weightsOf } from './program';
import type { Program } from './program';
import { REALISTIC, REALISTIC_UNIFORMS } from './realisticShader';
import { riverStore } from './riverTuning';
import { waterStore } from './waterMode';
import { WAVELETS } from './waveletsShader';

/**
 * The water, as a MapLibre custom layer drawn over the terrain and under the ink and the fog.
 *
 * Where the water is, how far from the shore and how deep, comes from the flat tiles through `waterMask.ts`,
 * one mask texture a tile, kept by `maskTiles.ts`. Everything that moves is worked out in the fragment shader
 * from the ground's own coordinates, so it pans with the map and needs no art. Each pattern comes in several
 * sizes that cross-fade by zoom, so it stays put on the ground and about the same size on the screen.
 *
 * Three ways to draw it, the Debug map's water switch: realistic, `realisticShader.ts`; the stylised
 * wavelets, the water's first look, kept to compare against; and still. The Flow renderer is drawn here too, in place of the water,
 * by `flowView.ts`. See decision record 0081.
 */

export const WATER_LAYER = 'water';

const R = WATER_LOOK.realistic;
const W = WATER_LOOK.wavelets;

export function createWaterLayer(worldRoot: string): maplibregl.CustomLayerInterface {
  let map: maplibregl.Map | null = null;
  let gl: WebGL2RenderingContext | null = null;
  let realistic: Program | null = null;
  let wavelets: Program | null = null;
  let flowProgram: Program | null = null;
  let quad: { vao: WebGLVertexArrayObject; buffer: WebGLBuffer } | null = null;
  /** For a tile with no rivers, or none worked out: no current anywhere in it. */
  let still: WebGLTexture | null = null;
  let nextFrame: ReturnType<typeof setTimeout> | null = null;
  let said = false;
  const started = performance.now();

  const repaint = () => map?.triggerRepaint();
  const flow = flowFilesOf(worldRoot);
  const tiles = createMaskTiles(worldRoot, flow, repaint);
  const flowView = createFlowView(flow, repaint);
  // A slider moved shows on the next frame even where nothing else is moving the map.
  const stopWatching = riverStore.watch(repaint);

  /** The tiles of a zoom the view covers, from its four corners, which a tipped camera needs. */
  const tilesInView = (level: number): TileRange => {
    const across = 2 ** level;
    const canvas = map!.getCanvas();
    let west = 1;
    let north = 1;
    let east = 0;
    let south = 0;
    for (const [x, y] of [
      [0, 0],
      [canvas.clientWidth, 0],
      [0, canvas.clientHeight],
      [canvas.clientWidth, canvas.clientHeight],
    ] as const) {
      const ground = MercatorCoordinate.fromLngLat(map!.unproject([x, y]));
      west = Math.min(west, ground.x);
      east = Math.max(east, ground.x);
      north = Math.min(north, ground.y);
      south = Math.max(south, ground.y);
    }
    return {
      across,
      fromX: Math.max(0, Math.floor(west * across)),
      toX: Math.min(across - 1, Math.floor(east * across)),
      fromY: Math.max(0, Math.floor(north * across)),
      toY: Math.min(across - 1, Math.floor(south * across)),
    };
  };

  /**
   * Keeps the water moving at its own frame rate, and only while some of it is on the screen: this is the one
   * thing keeping the map redrawing while nothing else changes.
   */
  const keepMoving = () => {
    if (nextFrame === null) {
      nextFrame = setTimeout(() => {
        nextFrame = null;
        repaint();
      }, 1000 / WATER_LOOK.framesPerSecond);
    }
  };

  /** The realistic water's own uniforms: its sizes of wave and caustic, and the rivers' sliders. */
  const realisticUniforms = (context: WebGL2RenderingContext, where: Program['where'], scale: number) => {
    context.uniform1fv(where.uWaves!, weightsOf(R.waves.first, 2, R.waves.sizes, R.waves.band, scale));
    context.uniform1fv(
      where.uCaustics!,
      weightsOf(R.caustics.first, 2, R.caustics.sizes, R.caustics.band, scale),
    );
    context.uniform1i(where.uFlow!, 1);
    context.uniform1i(where.uAlong!, 2);
    const period = flow.alongPeriod();
    context.uniform1f(where.uAlongPeriod!, period);
    const river = riverStore.get();
    // A whole, even number of ripples fits the period, so the pattern comes round with the coordinate.
    const ripples = Math.max(2, 2 * Math.round(period / (2 * river.spacing)));
    context.uniform1f(where.uRiverSpeed!, river.speed);
    context.uniform1f(where.uRippleSpacing!, period / ripples);
    context.uniform1f(where.uRippleBow!, river.bow);
    context.uniform1f(where.uRippleSharpness!, river.sharpness);
    context.uniform1f(where.uRippleBright!, river.ripples);
    context.uniform1f(where.uSpeckBright!, river.specks);
    context.uniform1f(where.uRiverWaves!, river.waves);
    context.uniform1f(where.uRiverCaustics!, river.caustics);
  };

  return {
    id: WATER_LAYER,
    type: 'custom',
    renderingMode: '2d',

    onAdd(added, context) {
      map = added;
      gl = context as WebGL2RenderingContext;
      realistic = link(gl, REALISTIC, REALISTIC_UNIFORMS);
      wavelets = link(gl, WAVELETS, ['uWeights']);
      flowProgram = link(gl, FLOW, ['uFlow', 'uCell', 'uMarch']);
      still = textureOf(gl, new Uint8Array([128, 128, 0, 255]), 1);
      quad = quadOf(gl);
    },

    render(context, options) {
      tiles.begin();
      const { mode, flowView: showingFlow } = waterStore.get();
      const zoom = map!.getZoom();
      const scale = pixelsPerWorldUnit(zoom);
      const start = {
        vao: quad!.vao,
        matrix: options.defaultProjectionData.mainMatrix,
        time: ((performance.now() - started) / 1000) % 3600,
        scale,
      };
      if (showingFlow) {
        const range = tilesInView(FLAT_MAX_ZOOM);
        if (flowProgram !== null && flowView.draw(context, flowProgram, start, zoom, range) > 0) {
          keepMoving();
        }
        return;
      }
      const fade = smoothstep(WATER_LOOK.fromZoom - 0.5, WATER_LOOK.fromZoom + 0.5, zoom);
      const drawing = mode === 'realistic' ? realistic : wavelets;
      if (mode === 'still' || fade <= 0 || !tiles.ready() || drawing === null) {
        return;
      }

      // Which mask tiles the view needs: the flat tiles a zoom coarser than the camera, so a mask texel is
      // a couple of pixels until the master's own pixels run out at the flat tiles' deepest zoom.
      const level = Math.max(0, Math.min(FLAT_MAX_ZOOM, Math.floor(zoom)));
      const { across, fromX, toX, fromY, toY } = tilesInView(level);

      const { where } = drawing;
      begin(context, drawing, start);
      context.uniform1i(where.uMask!, 0);
      context.uniform1f(where.uFade!, fade);
      if (mode === 'realistic') {
        realisticUniforms(context, where, scale);
      } else {
        context.uniform1fv(where.uWeights!, weightsOf(W.firstCell, W.step, W.sizes, W.band, scale));
      }

      let drawn = 0;
      for (let y = fromY; y <= toY; y += 1) {
        for (let x = fromX; x <= toX; x += 1) {
          // Its own mask, or while that is on its way the part of an ancestor's that covers it.
          const tile = tiles.drawable(context, level, x, y);
          if (tile === null) {
            continue;
          }
          const part = 1 / 2 ** tile.up;
          context.activeTexture(context.TEXTURE2);
          context.bindTexture(context.TEXTURE_2D, tile.along ?? still);
          context.activeTexture(context.TEXTURE1);
          context.bindTexture(context.TEXTURE_2D, tile.flow ?? still);
          context.activeTexture(context.TEXTURE0);
          context.bindTexture(context.TEXTURE_2D, tile.mask);
          context.uniform3f(where.uTile!, x / across, y / across, 1 / across);
          context.uniform4f(
            where.uTexRect!,
            (x - ((x >> tile.up) << tile.up)) * part,
            (y - ((y >> tile.up) << tile.up)) * part,
            part,
            part,
          );
          context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
          drawn += 1;
        }
      }
      context.bindVertexArray(null);
      tiles.forget(context);

      if (drawn > 0 && !said) {
        said = true;
        note('water', `drawn over ${drawn} tiles of sea, lake and river at zoom ${level}`);
      }
      if (drawn > 0) {
        keepMoving();
      }
    },

    onRemove() {
      if (nextFrame !== null) {
        clearTimeout(nextFrame);
      }
      stopWatching();
      tiles.dispose(gl);
      flowView.dispose(gl);
      gl?.deleteTexture(still);
      for (const program of [realistic, wavelets, flowProgram]) {
        gl?.deleteProgram(program?.program ?? null);
      }
      gl?.deleteBuffer(quad?.buffer ?? null);
      gl?.deleteVertexArray(quad?.vao ?? null);
      map = null;
    },
  };
}

/** Puts the water on the map, over whichever renderer is drawing the terrain and under the ink lines. */
export function placeWater(map: maplibregl.Map, worldRoot: string): void {
  if (map.getLayer('lake-shore') === undefined) {
    // Someone else's map, through VITE_MAP_STYLE_URL: there are no flat tiles to find the water in.
    return;
  }
  if (map.getLayer(WATER_LAYER) === undefined) {
    // A shader that will not compile throws from inside MapLibre and is otherwise said nowhere at all.
    try {
      map.addLayer(createWaterLayer(worldRoot), 'lake-shore');
    } catch (error) {
      note(
        'water',
        `the water could not be drawn: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    map.moveLayer(WATER_LAYER, 'lake-shore');
  }
}

import type * as maplibregl from 'maplibre-gl';
import { MercatorCoordinate } from 'maplibre-gl';

import { note } from '../log/log';
import { pixelsPerWorldUnit } from '../geometry/cameraMath';
import { FLAT_MAX_ZOOM } from '../geometry/world';
import { createCostMeter } from '../shaders/costMeter';
import type { CostMeter } from '../shaders/costMeter';
import { drawnAt, sayLevel, shadersStore } from '../shaders/levels';
import type { ShaderLevel } from '../shaders/levels';

import { flowFilesOf } from './flowFiles';
import { FLOW } from './flowShader';
import { createFlowView } from './flowView';
import type { TileRange } from './flowView';
import { WATER_LOOK } from './look';
import { createMaskTiles } from './maskTiles';
import { createPicture } from './picture';
import type { Picture } from './picture';
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
 * Two looks, chosen in the Water part of the debug panel's Shaders section: realistic, `realisticShader.ts`; and
 * the stylised wavelets, the water's first look, kept to compare against. And three levels, in that part's bar:
 * off; low, drawn into a picture of its own at a part of the screen's size, `picture.ts`, at a lower rate; and
 * high, the whole screen at the full rate. What a level costs the graphics card is said once in the log, the first
 * time the water is drawn at it. The Flow renderer is drawn here too, in place of the water, by `flowView.ts`,
 * whatever the level. See decision record 0081.
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
  let picture: Picture | null = null;
  let meter: CostMeter | null = null;
  /** The levels whose cost has been said, and the one the water was last drawn at. */
  const measured = new Set<ShaderLevel>();
  let lastLevel: ShaderLevel | null = null;
  const started = performance.now();

  const repaint = () => map?.triggerRepaint();
  const flow = flowFilesOf(worldRoot);
  const tiles = createMaskTiles(worldRoot, flow, repaint);
  const flowView = createFlowView(flow, repaint);
  // A slider moved shows on the next frame even where nothing else is moving the map.
  const stopWatching = riverStore.watch(repaint);
  const stopWatchingShaders = shadersStore.watch(repaint);

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
  const keepMoving = (framesPerSecond: number) => {
    if (nextFrame === null) {
      nextFrame = setTimeout(() => {
        nextFrame = null;
        repaint();
      }, 1000 / framesPerSecond);
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
      picture = createPicture(gl);
      meter = createCostMeter(gl);
    },

    render(context, options) {
      tiles.begin();
      const { level: own, look, flowView: showingFlow } = waterStore.get();
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
          keepMoving(WATER_LOOK.levels.high.framesPerSecond);
        }
        return;
      }
      const fade = smoothstep(WATER_LOOK.fromZoom - 0.5, WATER_LOOK.fromZoom + 0.5, zoom);
      const drawing = look === 'realistic' ? realistic : wavelets;
      const level = drawnAt(own);
      if (level === 'off' || fade <= 0 || !tiles.ready() || drawing === null) {
        return;
      }
      const levelLook = WATER_LOOK.levels[level];
      if (level !== lastLevel) {
        lastLevel = level;
        if (!measured.has(level)) meter?.again();
      }

      // Which mask tiles the view needs: the flat tiles a zoom coarser than the camera, so a mask texel is
      // a couple of pixels until the master's own pixels run out at the flat tiles' deepest zoom.
      const tileZoom = Math.max(0, Math.min(FLAT_MAX_ZOOM, Math.floor(zoom)));
      const { across, fromX, toX, fromY, toY } = tilesInView(tileZoom);

      const measuring = meter?.start() ?? false;
      const low = levelLook.resolution < 1;
      if (low) picture!.begin(context, levelLook.resolution);
      const { where } = drawing;
      begin(context, drawing, start);
      context.uniform1i(where.uMask!, 0);
      context.uniform1f(where.uFade!, fade);
      if (look === 'realistic') {
        realisticUniforms(context, where, scale);
      } else {
        context.uniform1fv(where.uWeights!, weightsOf(W.firstCell, W.step, W.sizes, W.band, scale));
      }

      let drawn = 0;
      for (let y = fromY; y <= toY; y += 1) {
        for (let x = fromX; x <= toX; x += 1) {
          // Its own mask, or while that is on its way the part of an ancestor's that covers it.
          const tile = tiles.drawable(context, tileZoom, x, y);
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
      if (low) picture!.end(context, quad!.vao);
      if (measuring) meter!.stop(drawn > 0);
      tiles.forget(context);

      const ms = meter?.read() ?? null;
      if (ms !== null) {
        measured.add(level);
        const share = ((ms * levelLook.framesPerSecond) / 10).toFixed(1);
        note(
          'water',
          `${sayLevel(level, levelLook)}: ${ms.toFixed(2)} ms of the graphics card a frame, ${share}% of its time`,
        );
      }
      if (drawn > 0) {
        keepMoving(levelLook.framesPerSecond);
      }
    },

    onRemove() {
      if (nextFrame !== null) {
        clearTimeout(nextFrame);
      }
      stopWatching();
      stopWatchingShaders();
      picture?.dispose(gl);
      meter?.dispose();
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

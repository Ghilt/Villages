import type * as maplibregl from 'maplibre-gl';
import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';
import { GROUND_LATTICE, HEIGHT_BOUNDS, HEIGHT_FORMAT, HEIGHT_MAX_ZOOM } from '@villages/world';
import type { Lattice } from '@villages/world';

import { note } from '../log/log';
import { drawnAt, shadersStore } from '../shaders/levels';
import type { ShaderLevel } from '../shaders/levels';

import { LIGHT } from './light';
import { steepenedAt, strengthAt, strengthByZoom } from './reliefCurve';
import { OUR_RELIEF_LAYER, createReliefLayer } from './reliefLayer';
import type { ReliefLook } from './reliefLayer';
import { reliefTuningStore } from './reliefTuning';

/**
 * The relief: the ground shaded by its slope, over the paint and under the water, read from the height tiles
 * `npm run world:height` cuts from ETOPO 2022, the whole world, carried onto the master through its origin map.
 * Decision record 0090, from experiment 0017.
 *
 * Drawn by a shader of our own, `reliefLayer.ts`, whose pixels are the lattice's diamonds, and beside it, to
 * compare, by MapLibre's own hillshade, whose pixels are square and which shows a seam along a height tile's edge
 * close in. How strongly, by zoom, is `reliefTuning.ts`'s, for both. The Relief part of the debug panel's Shaders
 * section: off, low or high in its bar, which draws it, and the levers of each inside. Low and high are how
 * strongly, not what it costs: neither costs the graphics card anything measurable. A way of looking, like the
 * water's level: neither remembered nor sent.
 */
export type ReliefMethod = 'standard' | 'basic' | 'combined' | 'igor' | 'multidirectional';

export const RELIEF_METHODS: readonly { name: ReliefMethod; note: string }[] = [
  { name: 'igor', note: 'shades slopes and leaves the flat alone, so the paint shows through' },
  { name: 'combined', note: 'darker the steeper, lit and shaded faces both' },
  { name: 'basic', note: 'lit and shaded faces by the angle to the light, as GDAL draws it' },
  { name: 'multidirectional', note: 'several lights at once, so no ridge loses its shape' },
  { name: 'standard', note: "MapLibre's first hillshade" },
];

export type ReliefDrawer = 'ours' | 'maplibre';

interface ReliefState {
  level: ShaderLevel;
  drawnBy: ReliefDrawer;
  /** MapLibre's way of shading; ours has one. */
  method: ReliefMethod;
  /**
   * Hard cells of shade rather than shade blended across the ground: ours, one a cell of the lattice the painted
   * renderers draw on; MapLibre's, one a height sample, square on the map.
   */
  pixels: boolean;
}

const relief = createStore<ReliefState>({ level: 'high', drawnBy: 'ours', method: 'igor', pixels: false });

export const reliefStore: Readable<ReliefState> = relief;

/** Each level at its fullest, before the zoom takes its share: how dark the shade, how bright the light. */
const STRENGTH: Record<
  Exclude<ShaderLevel, 'off'>,
  { exaggeration: number; shade: number; light: number }
> = {
  low: { exaggeration: 0.35, shade: 0.35, light: 0.2 },
  high: { exaggeration: 0.7, shade: 0.6, light: 0.35 },
};

/**
 * How far from flat our shade is shaded or lit through. At 1.6 a slope of thirty degrees turned from the light
 * is shaded about three quarters of the way, so steep valleys still have a darkest tone to go to.
 */
const GAIN = 1.6;

const SOURCE = 'height';
const LAYER = 'relief';
const UNDER = 'lake-shore';

let lattice: Lattice = GROUND_LATTICE;

export function setReliefLevel(level: ShaderLevel): void {
  if (level !== relief.get().level) {
    note('relief', level === 'off' ? 'off: the ground is as painted' : `${level}: ${sayStrength(level)}`);
    relief.set({ level });
  }
}

export function setReliefDrawer(drawnBy: ReliefDrawer): void {
  if (drawnBy !== relief.get().drawnBy) {
    note('relief', drawnBy === 'ours' ? 'drawn by our shader' : "drawn by MapLibre's hillshade");
    relief.set({ drawnBy });
  }
}

export function setReliefMethod(method: ReliefMethod): void {
  if (method !== relief.get().method) {
    note('relief', `${method}: ${RELIEF_METHODS.find((one) => one.name === method)?.note ?? ''}`);
    relief.set({ method });
  }
}

export function setReliefPixels(pixels: boolean): void {
  if (pixels !== relief.get().pixels) {
    note(
      'relief',
      pixels
        ? 'pixels: ours a shade a cell of the lattice, MapLibre a block a height sample'
        : 'smooth: the shade blended across the ground',
    );
    relief.set({ pixels });
  }
}

function sayStrength(level: Exclude<ShaderLevel, 'off'>): string {
  const { shade } = STRENGTH[level];
  return `shade at ${Math.round(shade * 100)}% at its fullest, as much of it at each zoom as the curve says`;
}

/** What our layer draws with at a zoom, read every frame it draws. */
function ourLook(zoom: number): ReliefLook {
  const { level, pixels } = relief.get();
  const { steepness, tones, ...curve } = reliefTuningStore.get();
  const strength = STRENGTH[level === 'off' ? 'high' : level];
  const share = Math.max(0, strengthAt(curve, zoom));
  const towards = (LIGHT.direction * Math.PI) / 180;
  const up = (LIGHT.altitude * Math.PI) / 180;
  return {
    pixels,
    tones,
    exaggeration: steepness * steepenedAt(zoom),
    gain: GAIN,
    shade: Math.min(1, strength.shade * share),
    light: Math.min(1, strength.light * share),
    sun: [Math.sin(towards) * Math.cos(up), Math.cos(towards) * Math.cos(up), Math.sin(up)],
    lattice,
  };
}

const resampling = () => (relief.get().pixels ? 'nearest' : 'linear');

function addSource(map: maplibregl.Map, worldRoot: string): void {
  map.addSource(SOURCE, {
    type: 'raster-dem',
    tiles: [`${worldRoot}/height/{z}/{x}/{y}.${HEIGHT_FORMAT}`],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: HEIGHT_MAX_ZOOM,
    bounds: [...HEIGHT_BOUNDS],
  });
}

function addLayer(map: maplibregl.Map, before: string): void {
  map.addLayer(
    {
      id: LAYER,
      type: 'hillshade',
      source: SOURCE,
      paint: {
        'hillshade-illumination-direction': LIGHT.direction,
        'hillshade-illumination-altitude': LIGHT.altitude,
        'hillshade-illumination-anchor': 'viewport',
        resampling: resampling(),
      },
    },
    before,
  );
}

/**
 * MapLibre settles how a tile's shade is stretched when it first shades that tile, so pixels on or off is a new
 * source and a new layer for it, put back where the old one stood: under ours and the water.
 */
function paint(map: maplibregl.Map, worldRoot: string): void {
  if (map.getPaintProperty(LAYER, 'resampling') !== resampling()) {
    const order = map.getLayersOrder();
    const next = order[order.indexOf(LAYER) + 1] ?? UNDER;
    map.removeLayer(LAYER);
    map.removeSource(SOURCE);
    addSource(map, worldRoot);
    addLayer(map, next);
  }
  const { level, method, drawnBy } = relief.get();
  const drawn = drawnAt(level);
  const shown = (by: ReliefDrawer) => (drawn !== 'off' && drawnBy === by ? 'visible' : 'none');
  map.setLayoutProperty(LAYER, 'visibility', shown('maplibre'));
  map.setLayoutProperty(OUR_RELIEF_LAYER, 'visibility', shown('ours'));
  map.triggerRepaint();
  if (drawn === 'off') {
    return;
  }
  // MapLibre's takes the zoom's share of its strength as expressions of the zoom, which it works out itself.
  const { exaggeration, shade, light } = STRENGTH[drawn];
  const curve = reliefTuningStore.get();
  const alpha = (most: number) => (share: number) => Math.min(1, Math.max(0, most * share)).toFixed(3);
  map.setPaintProperty(LAYER, 'hillshade-method', method);
  map.setPaintProperty(
    LAYER,
    'hillshade-exaggeration',
    strengthByZoom(curve, (share) => Math.min(1, Math.max(0, exaggeration * share))),
  );
  map.setPaintProperty(
    LAYER,
    'hillshade-shadow-color',
    strengthByZoom(curve, (share) => `rgba(52, 44, 72, ${alpha(shade)(share)})`),
  );
  map.setPaintProperty(
    LAYER,
    'hillshade-highlight-color',
    strengthByZoom(curve, (share) => `rgba(255, 249, 230, ${alpha(light)(share)})`),
  );
  map.setPaintProperty(
    LAYER,
    'hillshade-accent-color',
    strengthByZoom(curve, (share) => `rgba(60, 48, 40, ${alpha(shade / 2)(share)})`),
  );
}

let placed: { map: maplibregl.Map; root: string; stop: () => void } | null = null;

/**
 * Puts the relief on the map, over whichever renderer is drawing the terrain and directly under the ink lines,
 * so the water placed after it lies over it. Called again after every change of renderer, which puts the paint
 * back over it, of master, whose height tiles are its own, and of lattice, whose cells ours draws its pixels on.
 */
export function placeRelief(map: maplibregl.Map, worldRoot: string, ground: Lattice): void {
  if (map.getLayer(UNDER) === undefined) {
    // Someone else's map, through VITE_MAP_STYLE_URL: there is no world of ours to shade.
    return;
  }
  lattice = ground;
  if (placed !== null && (placed.map !== map || placed.root !== worldRoot)) {
    placed.stop();
    if (placed.map === map) {
      map.removeLayer(LAYER);
      map.removeLayer(OUR_RELIEF_LAYER);
      map.removeSource(SOURCE);
    }
    placed = null;
  }
  if (map.getSource(SOURCE) === undefined) {
    addSource(map, worldRoot);
  }
  if (map.getLayer(LAYER) === undefined) {
    addLayer(map, UNDER);
  } else {
    map.moveLayer(LAYER, UNDER);
  }
  if (map.getLayer(OUR_RELIEF_LAYER) === undefined) {
    map.addLayer(createReliefLayer(worldRoot, ourLook), UNDER);
  } else {
    map.moveLayer(OUR_RELIEF_LAYER, UNDER);
  }
  paint(map, worldRoot);

  if (placed === null) {
    const repaint = () => paint(map, worldRoot);
    const stops = [relief.watch(repaint), shadersStore.watch(repaint), reliefTuningStore.watch(repaint)];
    const missing = (event: maplibregl.ErrorEvent & { sourceId?: string }) => {
      if (event.sourceId === SOURCE) {
        note('relief', 'no height tiles here: npm run world:height, which fetches what it needs');
        map.off('error', missing);
      }
    };
    map.on('error', missing);
    placed = {
      map,
      root: worldRoot,
      stop: () => {
        for (const stop of stops) stop();
        map.off('error', missing);
      },
    };
  }
}

import type * as maplibregl from 'maplibre-gl';
import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';
import { HEIGHT_BOUNDS, HEIGHT_MAX_ZOOM } from '@villages/world';

import { note } from '../log/log';
import { drawnAt, shadersStore } from '../shaders/levels';
import type { ShaderLevel } from '../shaders/levels';

/**
 * The relief experiment (0016): the ground shaded by its slope, MapLibre's own hillshade over the paint and
 * under the water, read from the height tiles `npm run world:height` cuts from ETOPO 2022. Only around the
 * Alps, 0 to 30 east and 30 to 60 north, which is all the height there is yet.
 *
 * The Relief part of the debug panel's Shaders section: off, low or high in its bar, a way of shading inside it.
 * Low and high are how strongly, not what it costs: a hillshade costs the graphics card next to nothing at
 * either. A way of looking, like the water's level: neither remembered nor sent.
 */
export type ReliefMethod = 'standard' | 'basic' | 'combined' | 'igor' | 'multidirectional';

export const RELIEF_METHODS: readonly { name: ReliefMethod; note: string }[] = [
  { name: 'igor', note: 'shades slopes and leaves the flat alone, so the paint shows through' },
  { name: 'combined', note: 'darker the steeper, lit and shaded faces both' },
  { name: 'basic', note: 'lit and shaded faces by the angle to the light, as GDAL draws it' },
  { name: 'multidirectional', note: 'several lights at once, so no ridge loses its shape' },
  { name: 'standard', note: "MapLibre's first hillshade" },
];

interface ReliefState {
  level: ShaderLevel;
  method: ReliefMethod;
  /**
   * A block of shade for every height sample, half a master pixel across, rather than the shade blended between
   * them: the relief for the `plate` renderer's hard cells. The blocks are square on the map, not its diamonds.
   */
  pixels: boolean;
}

const relief = createStore<ReliefState>({ level: 'high', method: 'igor', pixels: false });

export const reliefStore: Readable<ReliefState> = relief;

/**
 * The light, from the upper right as the scenery's shadows are cut for (`LOOK-AND-FEEL.md`): they fall a third of
 * a sprite's height to the left and a tenth below, so the light stands seventy degrees round from north.
 */
const LIGHT = { direction: 70, altitude: 40 } as const;

const STRENGTH: Record<
  Exclude<ShaderLevel, 'off'>,
  { exaggeration: number; shade: number; light: number }
> = {
  low: { exaggeration: 0.35, shade: 0.35, light: 0.2 },
  high: { exaggeration: 0.7, shade: 0.6, light: 0.35 },
};

const SOURCE = 'height';
const LAYER = 'relief';
const UNDER = 'lake-shore';

export function setReliefLevel(level: ShaderLevel): void {
  if (level !== relief.get().level) {
    note('relief', level === 'off' ? 'off: the ground is as painted' : `${level}: ${sayStrength(level)}`);
    relief.set({ level });
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
        ? 'pixels: a block of shade for every height sample, from about zoom 8 in'
        : 'smooth: the shade blended between height samples',
    );
    relief.set({ pixels });
  }
}

function sayStrength(level: Exclude<ShaderLevel, 'off'>): string {
  const { exaggeration, shade } = STRENGTH[level];
  return `slopes ${exaggeration} as steep, shade at ${Math.round(shade * 100)}%`;
}

const resampling = () => (relief.get().pixels ? 'nearest' : 'linear');

function addSource(map: maplibregl.Map, worldRoot: string): void {
  map.addSource(SOURCE, {
    type: 'raster-dem',
    tiles: [`${worldRoot}/height/{z}/{x}/{y}.png`],
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
 * source and a new layer, put back where the old one stood: under the water, which this module does not name.
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
  const { level, method } = relief.get();
  const drawn = drawnAt(level);
  map.setLayoutProperty(LAYER, 'visibility', drawn === 'off' ? 'none' : 'visible');
  if (drawn === 'off') {
    return;
  }
  const { exaggeration, shade, light } = STRENGTH[drawn];
  map.setPaintProperty(LAYER, 'hillshade-method', method);
  map.setPaintProperty(LAYER, 'hillshade-exaggeration', exaggeration);
  map.setPaintProperty(LAYER, 'hillshade-shadow-color', `rgba(52, 44, 72, ${shade})`);
  map.setPaintProperty(LAYER, 'hillshade-highlight-color', `rgba(255, 249, 230, ${light})`);
  map.setPaintProperty(LAYER, 'hillshade-accent-color', `rgba(60, 48, 40, ${shade / 2})`);
}

let placed: { map: maplibregl.Map; root: string; stop: () => void } | null = null;

/**
 * Puts the relief on the map, over whichever renderer is drawing the terrain and directly under the ink lines,
 * so the water placed after it lies over it. Called again after every change of renderer, which puts the paint
 * back over it, and again after a change of master, whose height tiles are its own.
 */
export function placeRelief(map: maplibregl.Map, worldRoot: string): void {
  if (map.getLayer(UNDER) === undefined) {
    // Someone else's map, through VITE_MAP_STYLE_URL: there is no world of ours to shade.
    return;
  }
  if (placed !== null && (placed.map !== map || placed.root !== worldRoot)) {
    placed.stop();
    if (placed.map === map) {
      map.removeLayer(LAYER);
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
  paint(map, worldRoot);

  if (placed === null) {
    const repaint = () => paint(map, worldRoot);
    const stopRelief = relief.watch(repaint);
    const stopShaders = shadersStore.watch(repaint);
    const missing = (event: maplibregl.ErrorEvent & { sourceId?: string }) => {
      if (event.sourceId === SOURCE) {
        note(
          'relief',
          'no height tiles here: npm run world:fetch-all -- --only etopo, then npm run world:height',
        );
        map.off('error', missing);
      }
    };
    map.on('error', missing);
    placed = {
      map,
      root: worldRoot,
      stop: () => {
        stopRelief();
        stopShaders();
        map.off('error', missing);
      },
    };
  }
}

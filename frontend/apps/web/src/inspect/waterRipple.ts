import type * as maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';

import { pixelsAt } from './waterGround';
import type { Picked } from './waterPicked';
import { waterFrom } from './waterReach';
import type { WaterSeen } from './waters';

/**
 * A crackle of gold out along the water from where a click named it, like a current through a wire: three sharp fronts
 * close behind one another, the first the brightest and the others fainter echoes of it, that travel together slowly
 * up and down a river from the click, round a lake, across a bay, and never over the land, flickering as they go, the
 * first throwing sparks ahead, fading to nothing. Each pixel of what the click picked is a point of light,
 * and how far along the water from the click it lies says when the front reaches it; a break in a river's painting
 * is leapt. A flourish, read from the page's own tiles on ground the house has revealed; nothing at all for a reader
 * who has asked for less motion. See `waterPicked.ts`.
 */

const SOURCE = 'water-ripple';
/** A faint wide glow of gold, and a small hot core of nearly white over it, which is where the crackle shows. */
const HALO = 'water-ripple-halo';
const CORE = 'water-ripple-core';

const GILT = '#ffb02a';
const SPARK = '#fff1b8';

/** How far along the water the light runs, in screen pixels at the zoom it was clicked at, bounded in pixels. */
const REACH_PX = 3600;
const LEAST_REACH = 24;
const MOST_REACH = 600;
/** How far off the click the water may be found, as the fence finds it. */
const NEAR_PX = 48;
const MOST_NEAR = 24;
/** The most pixels it lights, which the sea about a click reaches first. */
const MOST_LIT = 50_000;
/**
 * The most points of light it draws: more water than this, a great lake or the sea, is lit at a pixel in every so
 * many each way, its lights widened to match, so that a frame of it costs no more than a river's does.
 */
const MOST_DRAWN = 6000;

/**
 * How fast the fronts run along the water, a second at a time, how long a tail of light each leaves, how wide each
 * front is, and how far ahead of the first sparks are thrown, all in screen pixels: slow enough to be seen running
 * rather than lighting the whole river at once.
 */
const SPEED_PX = 320;
const TAIL_PX = 30;
const EDGE_PX = 8;
const SPARKS_AHEAD_PX = 24;
/** The fronts, how far behind the first each runs in screen pixels, and how bright: close, so they run as one. */
const FRONTS = [
  { behind: 0, bright: 0.75 },
  { behind: 44, bright: 0.42 },
  { behind: 88, bright: 0.22 },
];
/** How many times a second the crackle changes, and how often a pixel ahead of the front sparks at each. */
const CRACKLE_HZ = 30;
const SPARKING = 0.06;

/**
 * How wide a pixel's glow and its core are, in pixels of the master, so that the lights run together over the river;
 * and never narrower than a few screen pixels, so that a river zoomed out still shines.
 */
const LIGHTS = [
  { layer: HALO, across: 3, least: 6 },
  { layer: CORE, across: 0.8, least: 1.8 },
] as const;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** How lit a pixel is, from what the animation last said of it. */
const LIT: maplibregl.ExpressionSpecification = ['coalesce', ['feature-state', 'lit'], 0];
/**
 * Whether a pixel is drawn at all: a dark one has no size, so that the graphics card draws only what is lit rather
 * than a blurred circle for every pixel of a great lake every frame.
 */
const SHOWN: maplibregl.ExpressionSpecification = ['case', ['>', LIT, 0], 1, 0];

/** The ripple's source and its two layers, added once and below whatever is added after them. */
export function addRipple(map: maplibregl.Map): void {
  map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: HALO,
    type: 'circle',
    source: SOURCE,
    paint: {
      'circle-color': GILT,
      'circle-radius': 6,
      'circle-radius-transition': { duration: 0 },
      'circle-blur': 1,
      'circle-opacity': ['*', 0.4, LIT],
      'circle-pitch-alignment': 'map',
    },
  });
  map.addLayer({
    id: CORE,
    type: 'circle',
    source: SOURCE,
    paint: {
      'circle-color': SPARK,
      'circle-radius': 2,
      'circle-radius-transition': { duration: 0 },
      'circle-blur': 0.6,
      'circle-opacity': ['*', 0.85, LIT],
      'circle-pitch-alignment': 'map',
    },
  });
}

export function removeRipple(map: maplibregl.Map): void {
  for (const layer of [CORE, HALO]) if (map.getLayer(layer) !== undefined) map.removeLayer(layer);
  if (map.getSource(SOURCE) !== undefined) map.removeSource(SOURCE);
}

/** Plays the light out along what a click on water picked; hands back what stops it. */
export function rippleAlong(map: maplibregl.Map, seen: WaterSeen, picked: Picked): () => void {
  const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (source === undefined || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => undefined;
  }
  const { grid, cells, leap, pixels } = picked;
  const reach = Math.min(MOST_REACH, Math.max(LEAST_REACH, REACH_PX / pixels));
  const near = Math.min(MOST_NEAR, Math.max(2, NEAR_PX / pixels));
  const reached = waterFrom({ lng: seen.at.lon, lat: seen.at.lat }, grid, cells, reach, near, MOST_LIT, leap);
  if (reached.length === 0) {
    return () => undefined;
  }

  // Thinned to a lattice when there is more of it than a frame can light point by point.
  const sparse = Math.max(1, Math.ceil(Math.sqrt(reached.length / MOST_DRAWN)));
  const drawn =
    sparse === 1 ? reached : reached.filter((one) => one.column % sparse === 0 && one.row % sparse === 0);

  // Each pixel's middle, as a place: out of world space, which is Mercator, unturned.
  const { width } = grid;
  const features: Feature[] = drawn.map((one, id) => {
    const lng = ((one.column + 0.5) / width) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (one.row + 0.5)) / width))) * 180) / Math.PI;
    return { type: 'Feature', id, properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } };
  });
  source.setData({ type: 'FeatureCollection', features });
  // As wide as its pixels are on the screen at every zoom, which doubles with each, and never too small to see; the
  // glow as wide again as the lattice is thinned, so that it still runs together, and the core a little wider.
  for (const { layer, across, least } of LIGHTS) {
    const wider = layer === HALO ? sparse : Math.sqrt(sparse);
    const stops: (number | maplibregl.ExpressionSpecification)[] = [];
    for (let zoom = 0; zoom <= 24; zoom += 1)
      stops.push(zoom, ['*', Math.max(least, (across * wider * pixelsAt(zoom, width)) / 2), SHOWN]);
    map.setPaintProperty(layer, 'circle-radius', ['interpolate', ['exponential', 2], ['zoom'], ...stops]);
  }

  const fars = drawn.map((one) => one.far);
  const speed = SPEED_PX / pixels;
  const tail = TAIL_PX / pixels;
  const edge = EDGE_PX / pixels;
  const started = performance.now();
  let frame = 0;
  let stopped = false;
  let lit = new Map<number, number>();
  const clear = () => {
    cancelAnimationFrame(frame);
    map.removeFeatureState({ source: SOURCE });
    source.setData(EMPTY);
  };
  const step = () => {
    if (stopped) {
      return;
    }
    const after = (performance.now() - started) / 1000;
    const tick = Math.floor(after * CRACKLE_HZ);
    const now = new Map<number, number>();
    let running = false;
    for (const [order, front] of FRONTS.entries()) {
      const at = after * speed - front.behind / pixels;
      const ahead = order === 0 ? SPARKS_AHEAD_PX / pixels : edge;
      if (at - tail > reach) {
        continue;
      }
      running = true;
      if (at + ahead < 0) {
        continue;
      }
      // Fading as it runs, to nothing at its furthest.
      const fade = Math.max(0, 1 - at / reach) ** 0.8 * front.bright;
      for (
        let index = firstFrom(fars, at - tail);
        index < fars.length && fars[index]! < at + ahead;
        index += 1
      ) {
        const far = fars[index]!;
        const flicker = noise(index, tick);
        let glow: number;
        if (far <= at) {
          // Behind the front: a tail that dies away fast, crackling as it goes.
          glow = Math.exp(-(at - far) / (tail * 0.35)) * (0.25 + 0.75 * flicker * flicker);
        } else if (far <= at + edge) {
          // The front itself: as bright as it gets, and it shivers.
          glow = 0.8 + 0.2 * flicker;
        } else {
          // Ahead of the first, now and then, a spark thrown forward; the others look no further than their edge.
          glow = noise(index, tick + 7919) < SPARKING ? 0.7 : 0;
        }
        glow *= fade;
        if (glow > 0.02 && glow > (now.get(index) ?? 0)) now.set(index, glow);
      }
    }
    for (const id of lit.keys()) if (!now.has(id)) map.setFeatureState({ source: SOURCE, id }, { lit: 0 });
    for (const [id, glow] of now) map.setFeatureState({ source: SOURCE, id }, { lit: glow });
    lit = now;
    if (running) {
      frame = requestAnimationFrame(step);
    } else {
      clear();
    }
  };
  frame = requestAnimationFrame(step);

  return () => {
    stopped = true;
    clear();
  };
}

/** A number from nought to one for a pixel at a tick of the crackle, the same each time it is asked. */
function noise(index: number, tick: number): number {
  const value = Math.sin(index * 12.9898 + tick * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** The first index whose distance is at least this, in distances sorted least first. */
function firstFrom(fars: readonly number[], least: number): number {
  let low = 0;
  let high = fars.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (fars[middle]! < least) low = middle + 1;
    else high = middle;
  }
  return low;
}

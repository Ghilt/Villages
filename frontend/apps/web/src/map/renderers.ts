import type * as maplibregl from 'maplibre-gl';
import { MAX_MERCATOR_LATITUDE } from '@villages/world';
import type { Lattice } from '@villages/world';

import { chosenMaster, worldRootOf } from './masters';
import { PAINTED_MAX_ZOOM, PAINTED_TILE } from './painterlyMessages';
import { painterlyTiles } from './painterlyTiles';

/**
 * The renderers the world can be drawn with, and the one piece of imperative map work needed to swap
 * between them.
 *
 * `raw` is the tiles as they are served: one flat colour a class, decided when the tiles were cut, with
 * the coast and the lake shores drawn over them as ink vectors. The rest are painted here in the browser
 * from the same terrain, and they draw their own shore, so the vector ink is turned off under them.
 *
 * `vivid` is painted like the rest and looks like neither: it draws the master's own colours with every
 * part of the medium turned off, so it is `raw` in the colours the world was actually painted in, at any
 * zoom and without cutting a second set of tiles. It answers a question rather than being a look.
 *
 * `biome` is not a look either, and is not even the terrain: it is the sprite map's own biome raster laid
 * on the world, flat, one colour a biome. It goes through no painter and no worker, because the raster is
 * already a Mercator square of the whole world - the same square the map is drawn on - so MapLibre places
 * it on the world's own corners and stretches it at any zoom. It is deliberately blocky: a biome is
 * sixteen world units, and seeing exactly how coarse that is is the point of looking.
 */

export interface RendererChoice {
  name: string;
  title: string;
  note: string;
}

export const RENDERERS: readonly RendererChoice[] = [
  { name: 'raw', title: 'Raw', note: 'One flat colour a class, baked into the tiles' },
  { name: 'painted', title: 'Painted', note: 'Washes, wet edges, and a mark for each kind of ground' },
  { name: 'atlas', title: 'Atlas', note: 'Ink and wash, with no mark at all: does the line carry it?' },
  { name: 'woodblock', title: 'Woodblock', note: 'A print: four steps of colour, coarse marks, hard ink' },
  { name: 'ink', title: 'Ink', note: 'Atlas further still: the line does all of the work' },
  { name: 'dusk', title: 'Dusk', note: 'The painted treatment under a low sun and a blue shadow' },
  { name: 'vivid', title: 'Vivid', note: "The master's own colours, pushed, with no medium over them" },
  { name: 'plate', title: 'Plate', note: "Raw's quieter colours, pushed the way vivid pushes the master's" },
  { name: 'biome', title: 'Biome', note: 'Not the terrain: what kind of place the sprite map thinks it is' },
  {
    name: 'flow',
    title: 'Flow',
    note: 'WIP spike: which way the rivers run, a colour for each way, arrows marching downstream from zoom 8, and black where a river has no way to the sea',
  },
];

export const DEFAULT_RENDERER = 'painted';

/**
 * How long a painted tile takes to fade in, in milliseconds.
 *
 * MapLibre's own is three hundred, which reads as a dissolve. Adam asked for a really short one: long
 * enough that a tile arriving is not a pop, short enough that it is over before the eye has decided it
 * is watching something happen.
 *
 * MapLibre is particular about when it fades. A tile fades in over a tile of its own source already
 * loaded above or below it, or on its own when it is on the outer edge of the view; a tile arriving
 * anywhere else with nothing of its own under it is drawn at full strength the moment it lands. So on the
 * coarse copy below, which is a handful of tiles and nearly all of them edges, this is a fade in; on the
 * sharp layer it is a fade wherever that layer has a tile of its own to fade from, and otherwise the sharp
 * tile lands on the coarse copy of itself, which reads as the ground coming into focus. See experiment 0008.
 */
const FADE_MS = 150;

const SOURCE = 'painterly';
const LAYER = 'painterly';

/**
 * A coarse copy of the painted ground, drawn underneath it, so that a place the map has not painted yet is
 * never empty.
 *
 * MapLibre draws a coarser tile in place of one it is still waiting for, but only one it already has: it
 * never asks for one on a loading tile's behalf. So on a zoom out to somewhere new there was nothing to
 * stand in, the screen was the desk until each tile landed, and every one of them popped. This source
 * asks for the coarse tiles itself. It serves the same painted tiles from the same store under the same
 * addresses, and declares them `COARSE_STRETCH` times wider than they are - and since MapLibre picks the
 * zoom to ask for from the tile size, that is enough to make it always ask two zooms coarser than the
 * sharp layer does. A sixteenth of the tiles, painted first because the queue paints the coarsest first,
 * stretched four times under the sharp ones. See `paintQueue.ts` and experiment 0008.
 */
const COARSE_SOURCE = 'painterly-coarse';
const COARSE_LAYER = 'painterly-coarse';

/** How much wider the coarse copy's tiles are declared than they are: four, which is two zooms. */
const COARSE_STRETCH = 4;

const BIOME_SOURCE = 'biome-raster';
const BIOME_LAYER = 'biome-raster';

/**
 * The corners of the world, as the biome raster covers them.
 *
 * World space is the Mercator square (0030), and the raster is a square of it, so its corners are the
 * square's corners: the whole of longitude, and latitude out to the Mercator limit. Anything less exact
 * and the biome under the camera would disagree with the biome the scenery is reading.
 */
const WORLD_CORNERS: [[number, number], [number, number], [number, number], [number, number]] = [
  [-180, MAX_MERCATOR_LATITUDE],
  [180, MAX_MERCATOR_LATITUDE],
  [180, -MAX_MERCATOR_LATITUDE],
  [-180, -MAX_MERCATOR_LATITUDE],
];
/** Drawn as vectors over the flat tiles. A painted renderer draws its own shore and does not want them. */
const INK_LAYERS = ['lake-shore', 'coast'];

/**
 * The flat tiles, which are hidden under a painted renderer rather than left showing through.
 *
 * Leaving them visible seems kinder, because a tile still being painted then shows terrain rather than
 * nothing. It is worse to watch. Land you are already looking at changes its colour and texture a
 * fraction of a second later, and a thing that changes draws the eye far harder than a thing that
 * merely arrives. With them hidden, what shows through is the coarse copy of the paint itself, so the worst
 * case is a moment of soft paint rather than a moment of the wrong paint.
 */
const FLAT_LAYER = 'terrain';

export function applyRenderer(map: maplibregl.Map, name: string, lattice: Lattice): void {
  // Swapping style means a different tile URL, so the sources go and come back rather than mutating.
  for (const [layer, source] of [
    [LAYER, SOURCE],
    [COARSE_LAYER, COARSE_SOURCE],
    [BIOME_LAYER, BIOME_SOURCE],
  ] as const) {
    if (map.getLayer(layer) !== undefined) {
      map.removeLayer(layer);
    }
    if (map.getSource(source) !== undefined) {
      map.removeSource(source);
    }
  }

  // The flow view is the flat tiles with most of their colour taken out, so the rivers' colours are the only
  // ones; every other look has the flat tiles as they were cut, whether it shows them or not.
  const flowing = name === 'flow';
  if (map.getLayer(FLAT_LAYER) !== undefined) {
    map.setPaintProperty(FLAT_LAYER, 'raster-saturation', flowing ? -0.9 : 0);
    map.setPaintProperty(FLAT_LAYER, 'raster-brightness-min', flowing ? 0.35 : 0);
  }

  if (name === 'biome') {
    // The flat terrain stays hidden under it: this is a different question about the same ground, and
    // showing both at once would only make the biome's own edges hard to find.
    for (const layer of [...INK_LAYERS, FLAT_LAYER]) {
      if (map.getLayer(layer) !== undefined) {
        map.setLayoutProperty(layer, 'visibility', 'none');
      }
    }
    map.addSource(BIOME_SOURCE, {
      type: 'image',
      url: `${worldRootOf(chosenMaster())}/sprites/biome/biomes.png`,
      coordinates: WORLD_CORNERS,
    });
    map.addLayer({
      id: BIOME_LAYER,
      type: 'raster',
      source: BIOME_SOURCE,
      // Nearest, so a biome cell is a square with an edge rather than a smear. The coarseness is the
      // thing being looked at and softening it would be the panel lying about the resolution.
      paint: { 'raster-opacity': 1, 'raster-resampling': 'nearest' },
    });
    return;
  }

  const painted = name !== 'raw' && !flowing;
  for (const layer of [...INK_LAYERS, FLAT_LAYER]) {
    if (map.getLayer(layer) !== undefined) {
      map.setLayoutProperty(layer, 'visibility', painted ? 'none' : 'visible');
    }
  }
  if (!painted) {
    return;
  }

  map.addSource(SOURCE, {
    type: 'raster',
    tiles: [painterlyTiles(name, lattice)],
    tileSize: PAINTED_TILE,
    minzoom: 0,
    // Past the flat tiles' own seven, so the paint is asked for a tile at the zoom being looked at and
    // the treatment stays the right size all the way in. This is the whole reason it is not baked. One
    // less than the world's own ten, because a 512-pixel tile is a zoom ahead of a 256 one; see
    // PAINTED_MAX_ZOOM for why that keeps exactly the pixels there were.
    maxzoom: PAINTED_MAX_ZOOM,
  });
  map.addLayer(
    {
      id: LAYER,
      type: 'raster',
      source: SOURCE,
      paint: { 'raster-opacity': 1, 'raster-resampling': 'linear', 'raster-fade-duration': FADE_MS },
    },
    map.getLayer(INK_LAYERS[0]!) === undefined ? undefined : INK_LAYERS[0],
  );

  map.addSource(COARSE_SOURCE, {
    type: 'raster',
    tiles: [painterlyTiles(name, lattice)],
    tileSize: PAINTED_TILE * COARSE_STRETCH,
    minzoom: 0,
    maxzoom: PAINTED_MAX_ZOOM,
  });
  map.addLayer(
    {
      id: COARSE_LAYER,
      type: 'raster',
      source: COARSE_SOURCE,
      paint: { 'raster-opacity': 1, 'raster-resampling': 'linear', 'raster-fade-duration': FADE_MS },
    },
    LAYER,
  );
}

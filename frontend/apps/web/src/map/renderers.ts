import type * as maplibregl from 'maplibre-gl';

import { chosenMaster, worldRootOf } from './masters';
import { painterlyTiles } from './painterlyTiles';
import { WORLD_MAX_ZOOM } from './worldStyle';

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
  { name: 'biome', title: 'Biome', note: 'Not the terrain: what kind of place the sprite map thinks it is' },
];

export const DEFAULT_RENDERER = 'painted';

const SOURCE = 'painterly';
const LAYER = 'painterly';
const BIOME_SOURCE = 'biome-raster';
const BIOME_LAYER = 'biome-raster';

/**
 * The corners of the world, as the biome raster covers them.
 *
 * World space is the Mercator square (0030), and the raster is a square of it, so its corners are the
 * square's corners: the whole of longitude, and latitude out to the Mercator limit. Anything less exact
 * and the biome under the camera would disagree with the biome the scenery is reading.
 */
const MERCATOR_LIMIT = 85.051129;
const WORLD_CORNERS: [[number, number], [number, number], [number, number], [number, number]] = [
  [-180, MERCATOR_LIMIT],
  [180, MERCATOR_LIMIT],
  [180, -MERCATOR_LIMIT],
  [-180, -MERCATOR_LIMIT],
];
/** Drawn as vectors over the flat tiles. A painted renderer draws its own shore and does not want them. */
const INK_LAYERS = ['lake-shore', 'coast'];

/**
 * The flat tiles, which are hidden under a painted renderer rather than left showing through.
 *
 * Leaving them visible seems kinder, because a tile still being painted then shows terrain rather than
 * nothing. It is worse to watch. Land you are already looking at changes its colour and texture a
 * fraction of a second later, and a thing that changes draws the eye far harder than a thing that
 * merely arrives. With them hidden, MapLibre falls back the way it does for any raster source, by stretching
 * the painted tile from a zoom further out, so the worst case is a moment of soft paint rather than a
 * moment of the wrong paint.
 */
const FLAT_LAYER = 'terrain';

export function applyRenderer(map: maplibregl.Map, name: string): void {
  // Swapping style means a different tile URL, so the source goes and comes back rather than mutating.
  for (const [layer, source] of [
    [LAYER, SOURCE],
    [BIOME_LAYER, BIOME_SOURCE],
  ] as const) {
    if (map.getLayer(layer) !== undefined) {
      map.removeLayer(layer);
    }
    if (map.getSource(source) !== undefined) {
      map.removeSource(source);
    }
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

  const painted = name !== 'raw';
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
    tiles: [painterlyTiles(name)],
    tileSize: 256,
    minzoom: 0,
    // Past the flat tiles' own seven, so the paint is asked for a tile at the zoom being looked at and
    // the treatment stays the right size all the way in. This is the whole reason it is not baked.
    maxzoom: WORLD_MAX_ZOOM,
  });
  map.addLayer(
    {
      id: LAYER,
      type: 'raster',
      source: SOURCE,
      paint: { 'raster-opacity': 1, 'raster-resampling': 'linear' },
    },
    map.getLayer(INK_LAYERS[0]!) === undefined ? undefined : INK_LAYERS[0],
  );
}

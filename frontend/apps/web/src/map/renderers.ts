import type * as maplibregl from 'maplibre-gl';
import type { Lattice } from '@villages/world';

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
];

export const DEFAULT_RENDERER = 'painted';

const SOURCE = 'painterly';
const LAYER = 'painterly';
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

export function applyRenderer(map: maplibregl.Map, name: string, lattice: Lattice): void {
  // Swapping style means a different tile URL, so the source goes and comes back rather than mutating.
  if (map.getLayer(LAYER) !== undefined) {
    map.removeLayer(LAYER);
  }
  if (map.getSource(SOURCE) !== undefined) {
    map.removeSource(SOURCE);
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
      paint: { 'raster-opacity': 1, 'raster-resampling': 'linear' },
    },
    map.getLayer(INK_LAYERS[0]!) === undefined ? undefined : INK_LAYERS[0],
  );
}

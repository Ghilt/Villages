import type { StyleSpecification } from 'maplibre-gl';

import { FLAT_MAX_ZOOM, WORLD_MAX_ZOOM } from '../geometry/world';

/**
 * The look of our world, and the whole of it: terrain, a coastline, lake shores, and not one word of text.
 *
 * There is no tile service behind this. Everything comes from `world/master/terrain.png`, the image the
 * world is painted in by hand. Terrain arrives as map tiles cut from that image, because thirty-two
 * classes over a world this detailed come to well over a hundred thousand outlines, most of which any
 * servable threshold would throw away. Only the lines a stylised map draws in ink are vectors: the coast,
 * and the lakes large enough to have a shape rather than a position. See docs/adr/0019.
 *
 * The colours the terrain is drawn in live in `world/render.json` and are baked into the tiles.
 *
 * Which master all of that was cut from is the `root` every function here is given: one directory per
 * master, so the debug map panel can draw any of them. See `map/masters.ts`.
 */

/** What the sea is drawn in, and so what the sheet is under the tiles. The desk's sheet reuses it. */
export const SEA = '#93aebc';
const INK = '#5f5544';

export function warpedWorldStyle(root: string): StyleSpecification {
  return {
    version: 8,
    name: 'Villages',
    sources: {
      terrain: {
        type: 'raster',
        tiles: [`${root}/tiles/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 0,
        // Beyond this the tiles are stretched: a tile pixel is already a master pixel here.
        maxzoom: FLAT_MAX_ZOOM,
      },
      outlines: {
        type: 'geojson',
        data: `${root}/terrain.geojson`,
        maxzoom: WORLD_MAX_ZOOM,
      },
    },
    layers: [
      { id: 'sea', type: 'background', paint: { 'background-color': SEA } },
      {
        // Nearest neighbour, so that zooming past the closest tiles shows honest square pixels rather
        // than a smear. A terrain class has no meaningful blend with its neighbour.
        id: 'terrain',
        type: 'raster',
        source: 'terrain',
        paint: { 'raster-opacity': 1, 'raster-resampling': 'nearest' },
      },
      {
        // Drawn over the tiles, so that a shoreline is a line rather than a staircase of pixels.
        id: 'lake-shore',
        type: 'line',
        source: 'outlines',
        filter: ['==', ['get', 'class'], 'lake'],
        minzoom: 4,
        paint: {
          'line-color': INK,
          'line-opacity': 0.4,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 10, 1.4],
        },
      },
      {
        id: 'coast',
        type: 'line',
        source: 'outlines',
        filter: ['==', ['get', 'class'], 'land'],
        paint: {
          'line-color': INK,
          'line-opacity': 0.75,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 6, 1.3, 10, 2.4],
        },
      },
    ],
  };
}

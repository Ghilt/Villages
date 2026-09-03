import type { StyleSpecification } from 'maplibre-gl';

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
 */

/** Beyond this the tiles are stretched, because a tile pixel is already a master pixel here. */
export const TERRAIN_TILE_MAX_ZOOM = 6;

export const WORLD_MAX_ZOOM = 10;

const SEA = '#93aebc';
const INK = '#5f5544';

/** Required: three of the four sources are CC-BY. See world/master/experiment/README.md. */
const CREDITS =
  'Copernicus Global Land Service &middot; HydroSHEDS &middot; RESOLVE Ecoregions &middot; Natural Earth';

export function warpedWorldStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Villages',
    sources: {
      terrain: {
        type: 'raster',
        tiles: ['/world/tiles/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 0,
        maxzoom: TERRAIN_TILE_MAX_ZOOM,
        attribution: CREDITS,
      },
      outlines: {
        type: 'geojson',
        data: '/world/terrain.geojson',
        maxzoom: WORLD_MAX_ZOOM,
      },
    },
    layers: [
      { id: 'sea', type: 'background', paint: { 'background-color': SEA } },
      { id: 'terrain', type: 'raster', source: 'terrain', paint: { 'raster-opacity': 1 } },
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

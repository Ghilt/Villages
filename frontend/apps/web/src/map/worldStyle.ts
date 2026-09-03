import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/**
 * The look of our world, and the whole of it: sea, terrain, water and a coastline, and not one word of
 * text.
 *
 * There is no tile service behind this. Every shape comes from `world/master/terrain.png`, the image the
 * world is painted in by hand, traced into outlines by the world import. See docs/adr/0018.
 *
 * These colours are a first pass, not the finished look: muted, close together, and meant to be read as a
 * whole rather than as a legend. The painterly treatment replaces them.
 */

const SEA = '#a3bac6';

/** Painted from the bottom up. Open land first, then what grows on it, then ice, then water. */
const TERRAIN: readonly { class: string; colour: string }[] = [
  { class: 'grassland', colour: '#dcd8a6' },
  { class: 'savanna', colour: '#dbc78c' },
  { class: 'desert', colour: '#e9d8ab' },
  { class: 'tundra', colour: '#cdcec2' },
  { class: 'alpine', colour: '#c2b6a4' },
  { class: 'wetland', colour: '#b4bc90' },
  { class: 'temperate-forest', colour: '#a7bf8d' },
  { class: 'boreal-forest', colour: '#8cac8a' },
  { class: 'tropical-forest', colour: '#90b488' },
  { class: 'ice', colour: '#eff2f2' },
  { class: 'lake', colour: '#93b1c2' },
  { class: 'river', colour: '#93b1c2' },
];

/** Natural Earth at the scale the master was painted from has no more to give past about this zoom. */
export const WORLD_MAX_ZOOM = 10;

function terrainLayer(terrain: { class: string; colour: string }): LayerSpecification {
  return {
    id: `terrain-${terrain.class}`,
    type: 'fill',
    source: 'terrain',
    filter: ['==', ['get', 'class'], terrain.class],
    paint: { 'fill-color': terrain.colour },
  };
}

export function warpedWorldStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Villages',
    sources: {
      terrain: { type: 'geojson', data: '/world/terrain.geojson', maxzoom: WORLD_MAX_ZOOM },
    },
    layers: [
      { id: 'sea', type: 'background', paint: { 'background-color': SEA } },
      ...TERRAIN.map(terrainLayer),
      {
        // The coast is the outline of everything that is not sea, traced as its own shape, so that it can
        // be drawn as one line rather than as the seam between a dozen fills.
        id: 'coast',
        type: 'line',
        source: 'terrain',
        filter: ['==', ['get', 'class'], 'land'],
        paint: {
          'line-color': '#6d6047',
          'line-opacity': 0.7,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 6, 1.2, 10, 2.2],
        },
      },
    ],
  };
}

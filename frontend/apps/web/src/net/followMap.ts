import type * as maplibregl from 'maplibre-gl';

import { MAX_ZOOM, cellsForView } from '@villages/protocol';

import { follow } from './gateway';

/**
 * How far past the edge of the view to hold cells: one ring, so that a small pan finds its houses already
 * there rather than arriving a moment after the terrain.
 */
const MARGIN = 1;

/**
 * Keeps the gateway following the camera. The cells asked for are the ones covering the view at the zoom
 * the map is asking terrain tiles at, so data and terrain arrive on the same grid; see decision 0026.
 * Returns what undoes it.
 */
export function followMap(map: maplibregl.Map): () => void {
  const look = () => {
    const bounds = map.getBounds();
    follow(
      cellsForView(
        {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
          zoom: Math.min(Math.round(map.getZoom()), MAX_ZOOM),
        },
        MARGIN,
      ),
    );
  };
  look();
  map.on('moveend', look);
  map.on('zoomend', look);
  return () => {
    map.off('moveend', look);
    map.off('zoomend', look);
  };
}

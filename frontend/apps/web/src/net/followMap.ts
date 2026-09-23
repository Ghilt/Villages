import type * as maplibregl from 'maplibre-gl';

import { MAX_ZOOM, cellsForView } from '@villages/protocol';

import { follow } from './gateway';

/**
 * How far past the edge of the view to hold cells: one ring, so that a small pan finds its houses already
 * there rather than arriving a moment after the terrain.
 */
const MARGIN = 1;

/**
 * How far past the midpoint the camera must go before the cells are asked for at a new zoom.
 *
 * Cell ids carry their zoom, so changing the zoom the view is followed at replaces every cell at once:
 * everything held is let go and everything wanted is asked for again. Rounding alone makes that happen
 * on a hair, and a trackpad resting near z8.5 crosses it repeatedly without the camera really moving.
 * A sixth of a zoom of stickiness costs nothing and turns a wobble into no work at all.
 */
const STICKY = 0.15;

/**
 * Which zoom to follow the view at, given where the camera is and where it was being followed.
 *
 * Pure, and the only arithmetic here, so the stickiness can be tested without a map. A step the camera
 * really made - a flight, a pinch, a click on the zoom control - is past the band and is taken at once.
 */
export function followZoom(zoom: number, was: number | null, maxZoom: number = MAX_ZOOM): number {
  const rounded = Math.min(Math.round(zoom), maxZoom);
  if (was === null) {
    return rounded;
  }
  return Math.abs(zoom - was) < 0.5 + STICKY ? was : rounded;
}

/**
 * Keeps the gateway following the camera. The cells asked for are the ones covering the view at the zoom
 * the map is asking terrain tiles at, so data and terrain arrive on the same grid; see decision 0026.
 * Returns what undoes it.
 */
export function followMap(map: maplibregl.Map): () => void {
  /** The zoom the cells in hand were asked for at, so the stickiness has something to stick to. */
  let following: number | null = null;

  const look = () => {
    const bounds = map.getBounds();
    following = followZoom(map.getZoom(), following);
    follow(
      cellsForView(
        {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
          zoom: following,
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

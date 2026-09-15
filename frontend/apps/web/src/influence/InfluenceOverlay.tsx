import { useEffect, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { fenceToPolygons, influenceZoneAround } from '@villages/world';
import type { Fence, MasterGrid } from '@villages/world';
import type { HouseView } from '@villages/protocol';

import { note } from '../debug/log';
import { terrainPalette } from '../map/terrainClasses';

interface InfluenceOverlayProps {
  map: maplibregl.Map | null;
  houses: readonly HouseView[];
}

const SOURCE = 'influence';
const SHADE = 'influence-shade';
const LINE = 'influence-line';

/** The gold of the interface: ground a house holds, rather than terrain or a line a player drew. */
const HELD = '#9d7c2a';

/**
 * How far a house's ground reaches, in master pixels. About twenty-five kilometres, which is a morning's
 * ride: near enough to be a neighbourhood and far enough to see at the zoom a house is drawn from.
 *
 * A number of the game's, and the only one here. When the world has something to say about how far a
 * house reaches, this moves into the domain and onto the events; until then it is a look.
 */
const REACH = 20;

/** Below the zoom a house is drawn as a marker, its ground is smaller than the mark and reads as dirt. */
const MINZOOM = 7;

/**
 * The ground each house holds, drawn as a fence about its seat.
 *
 * Headless, like the area overlay it is modelled on: it owns a source and two layers and renders
 * nothing of its own. The fences are worked out from the seats rather than stored, and memoised by
 * house, because a seat never moves and tracing a ring is not free. See decision records 0032 and 0034.
 */
export function InfluenceOverlay({ map, houses }: InfluenceOverlayProps) {
  const [grid, setGrid] = useState<MasterGrid | null>(null);
  const fences = useRef(new Map<string, Fence>());

  useEffect(() => {
    let looking = true;
    terrainPalette().then(
      (palette) => {
        if (looking) {
          setGrid({ width: palette.masterWidth, height: palette.masterHeight });
        }
      },
      (cause: unknown) => {
        note('influence', `no palette, so no ground is drawn: ${String(cause)}`);
      },
    );
    return () => {
      looking = false;
    };
  }, []);

  useEffect(() => {
    if (map === null) {
      return;
    }
    map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: SHADE,
      type: 'fill',
      source: SOURCE,
      minzoom: MINZOOM,
      paint: { 'fill-color': HELD, 'fill-opacity': 0.12 },
    });
    map.addLayer({
      id: LINE,
      type: 'line',
      source: SOURCE,
      minzoom: MINZOOM,
      paint: { 'line-color': HELD, 'line-opacity': 0.75, 'line-width': 1.4 },
    });

    return () => {
      // The map may already have been taken down, in which case it has no style to take layers out of.
      try {
        for (const layer of [LINE, SHADE]) {
          if (map.getLayer(layer) !== undefined) {
            map.removeLayer(layer);
          }
        }
        if (map.getSource(SOURCE) !== undefined) {
          map.removeSource(SOURCE);
        }
      } catch {
        // Nothing to undo.
      }
    };
  }, [map]);

  useEffect(() => {
    if (map === null || grid === null) {
      return;
    }
    const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source === undefined) {
      return;
    }

    const features = houses.map((house) => {
      let fence = fences.current.get(house.id);
      if (fence === undefined) {
        fence = influenceZoneAround({ lng: house.seat.lon, lat: house.seat.lat }, grid, REACH);
        fences.current.set(house.id, fence);
      }
      return {
        type: 'Feature' as const,
        properties: { id: house.id },
        geometry: { type: 'MultiPolygon' as const, coordinates: fenceToPolygons(fence, grid) },
      };
    });

    source.setData({ type: 'FeatureCollection', features });
  }, [map, houses, grid]);

  return null;
}

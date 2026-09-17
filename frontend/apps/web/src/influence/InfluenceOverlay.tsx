import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { fenceToPolygons, influenceZoneAround } from '@villages/world';
import type { Fence, MasterGrid } from '@villages/world';
import type { HouseView } from '@villages/protocol';

import { note } from '../debug/log';
import { seeingEverything, watchSeeingEverything } from '../debug/seeEverything';
import { terrainPalette } from '../map/terrainClasses';

interface InfluenceOverlayProps {
  map: maplibregl.Map | null;
  houses: readonly HouseView[];
  /** The player's own house while the eye is open, whose ground is drawn at any zoom; null otherwise. */
  mine: HouseView | null;
}

const SOURCE = 'influence';
const SHADE = 'influence-shade';
const LINE = 'influence-line';

/** The same again for the player's own ground, which is drawn under different rules. See 0038. */
const OWN_SOURCE = 'influence-own';
const OWN_SHADE = 'influence-own-shade';
const OWN_LINE = 'influence-own-line';

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

/** Seeing everything, or keeping your own in sight, draws the ground however far back the camera is. */
const NO_MINZOOM = 0;

/**
 * The ground each house holds, drawn as a fence about its seat.
 *
 * Headless, like the area overlay it is modelled on: it owns its sources and layers and renders nothing
 * of its own. The fences are worked out from the seats rather than stored, and memoised by house,
 * because a seat never moves and tracing a ring is not free. See decision records 0032 and 0034.
 *
 * Two sources, not one. Everyone's ground is drawn from the zoom where a ring is bigger than the mark
 * it sits under; the player's own, while the eye is open, is drawn below that too, and a zoom range in
 * MapLibre belongs to a layer rather than to a feature. See decision record 0038.
 */
export function InfluenceOverlay({ map, houses, mine }: InfluenceOverlayProps) {
  const [grid, setGrid] = useState<MasterGrid | null>(null);
  const fences = useRef(new Map<string, Fence>());
  const everything = useSyncExternalStore(watchSeeingEverything, seeingEverything);

  // Worked out from the seat rather than stored, and memoised by house, because a seat never moves and
  // tracing a ring is not free. Both the everyone source and the own one ask through here.
  const fenceFor = useCallback((house: HouseView, on: MasterGrid): Fence => {
    let fence = fences.current.get(house.id);
    if (fence === undefined) {
      fence = influenceZoneAround({ lng: house.seat.lon, lat: house.seat.lat }, on, REACH);
      fences.current.set(house.id, fence);
    }
    return fence;
  }, []);

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

    // The player's own ground, on its own source and its own pair of layers. Not a filter on the pair
    // above, because what differs is the zoom range and MapLibre has one of those per layer, not per
    // feature. It hands over at MINZOOM, where the pair above starts drawing everyone's.
    map.addSource(OWN_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: OWN_SHADE,
      type: 'fill',
      source: OWN_SOURCE,
      minzoom: NO_MINZOOM,
      maxzoom: MINZOOM,
      paint: { 'fill-color': HELD, 'fill-opacity': 0.12 },
    });
    map.addLayer({
      id: OWN_LINE,
      type: 'line',
      source: OWN_SOURCE,
      minzoom: NO_MINZOOM,
      maxzoom: MINZOOM,
      paint: { 'line-color': HELD, 'line-opacity': 0.85, 'line-width': 1.6 },
    });

    return () => {
      // The map may already have been taken down, in which case it has no style to take layers out of.
      try {
        for (const layer of [OWN_LINE, OWN_SHADE, LINE, SHADE]) {
          if (map.getLayer(layer) !== undefined) {
            map.removeLayer(layer);
          }
        }
        for (const source of [OWN_SOURCE, SOURCE]) {
          if (map.getSource(source) !== undefined) {
            map.removeSource(source);
          }
        }
      } catch {
        // Nothing to undo.
      }
    };
  }, [map]);

  // Seeing everything lowers the floor rather than adding a layer: one source, two layers, and a number
  // that moves. See decision record 0038.
  useEffect(() => {
    if (map === null) {
      return;
    }
    const floor = everything ? NO_MINZOOM : MINZOOM;
    for (const layer of [SHADE, LINE]) {
      if (map.getLayer(layer) !== undefined) {
        map.setLayerZoomRange(layer, floor, 24);
      }
    }
  }, [map, everything]);

  useEffect(() => {
    if (map === null || grid === null) {
      return;
    }
    const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source === undefined) {
      return;
    }

    const features = houses.map((house) => ({
      type: 'Feature' as const,
      properties: { id: house.id },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: fenceToPolygons(fenceFor(house, grid), grid),
      },
    }));

    source.setData({ type: 'FeatureCollection', features });
  }, [map, houses, grid, fenceFor]);

  // The player's own ground, while the eye is open. Nothing while seeing everything, because the pair
  // above is then already drawing it from zoom zero and two of the same ring is twice the shade.
  useEffect(() => {
    if (map === null || grid === null) {
      return;
    }
    const source = map.getSource(OWN_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source === undefined) {
      return;
    }
    const features =
      mine === null || everything
        ? []
        : [
            {
              type: 'Feature' as const,
              properties: { id: mine.id },
              geometry: {
                type: 'MultiPolygon' as const,
                coordinates: fenceToPolygons(fenceFor(mine, grid), grid),
              },
            },
          ];
    source.setData({ type: 'FeatureCollection', features });
  }, [map, mine, everything, grid, fenceFor]);

  return null;
}

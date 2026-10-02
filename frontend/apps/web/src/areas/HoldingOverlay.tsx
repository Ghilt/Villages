import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { areaAround, fenceToPolygons, seedOf } from '@villages/world';
import type { DiamondGrid, Fence } from '@villages/world';
import type { HouseView } from '@villages/protocol';

import { note } from '../log/log';
import { sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';
import { terrainPalette } from '../geometry/terrainClasses';

interface HoldingOverlayProps {
  map: maplibregl.Map | null;
  houses: readonly HouseView[];
  /** The player's own house while the eye is open, whose ground is drawn at any zoom; null otherwise. */
  mine: HouseView | null;
  /** How far the ground's grid is turned, in degrees, which is how far a holding's diamonds are. */
  turn: number;
}

const SOURCE = 'holding';
const SHADE = 'holding-shade';
const LINE = 'holding-line';

/** The same again for the player's own ground, which is drawn under different rules. See 0038. */
const OWN_SOURCE = 'holding-own';
const OWN_SHADE = 'holding-own-shade';
const OWN_LINE = 'holding-own-line';

/** The gold of the interface: ground a house holds, rather than terrain or a line a player drew. */
const HELD = '#9d7c2a';

/**
 * How far a house's ground reaches, in world units, on average. Twenty-five, which is as much ground as
 * the round holding drawn on the master had at Mordaunt's latitude: some nineteen hundred diamonds, about
 * twenty kilometres out. Near enough to be a neighbourhood and far enough to see at the zoom a house is
 * drawn from.
 *
 * A placeholder, Adam's word for it on 2026-09-27, and so are the two numbers below it. When the world has
 * something to say about how far a house reaches, this moves into the domain and onto the events; until
 * then it is a look.
 */
const REACH = 25;

/**
 * How ragged the ground is: the reach wanders in and out by a quarter of itself on the way round, and every
 * diamond's distance is jittered by a diamond and a half, so the edge is a fraying, lumpy thing rather than
 * a circle. Always one piece with no holes, whatever these are. See `areaAround`.
 */
const LUMPS = 0.25;
const JITTER = 1.5;

/** Below the zoom a house is drawn as a marker, its ground is smaller than the mark and reads as dirt. */
const MINZOOM = 7;

/** Seeing everything, or keeping your own in sight, draws the ground however far back the camera is. */
const NO_MINZOOM = 0;

/**
 * A house's **holding**, drawn as a fence about its seat: the ground it has on the map.
 *
 * The shape is an **area** and nothing more - `areaAround`, the same component anything else fenced
 * uses. What makes it a holding is what draws it and in what colour, which is this file. A castle's
 * influence zone later is the same call with a different dress. See decision record 0032.
 *
 * Headless, like the area overlay it is modelled on: it owns its sources and layers and renders nothing
 * of its own. The fences are worked out from the seats rather than stored, and memoised by house,
 * because a seat never moves and tracing a ring is not free. See decision records 0032 and 0034.
 *
 * Two sources, not one. Everyone's ground is drawn from the zoom where a ring is bigger than the mark
 * it sits under; the player's own, while the eye is open, is drawn below that too, and a zoom range in
 * MapLibre belongs to a layer rather than to a feature. See decision record 0038.
 */
export function HoldingOverlay({ map, houses, mine, turn }: HoldingOverlayProps) {
  const [width, setWidth] = useState<number | null>(null);
  const grid = useMemo((): DiamondGrid | null => (width === null ? null : { width, turn }), [width, turn]);
  const fences = useRef(new Map<string, Fence>());
  const everything = useStore(sessionStore, (state) => state.seeAll);

  // Worked out from the seat rather than stored, and memoised by house and by how far the diamonds are
  // turned, because a seat never moves and tracing a ring is not free, and a turned ground is other
  // diamonds. Seeded by the house, so its ground is the same shape on every screen that draws it. Both the
  // everyone source and the own one ask through here.
  const fenceFor = useCallback((house: HouseView, on: DiamondGrid): Fence => {
    const key = `${house.id} ${on.turn}`;
    let fence = fences.current.get(key);
    if (fence === undefined) {
      fence = areaAround({ lng: house.seat.lon, lat: house.seat.lat }, on, REACH, {
        seed: seedOf(house.id),
        lumps: LUMPS,
        jitter: JITTER,
      });
      fences.current.set(key, fence);
    }
    return fence;
  }, []);

  useEffect(() => {
    let looking = true;
    terrainPalette().then(
      (palette) => {
        if (looking) {
          setWidth(palette.masterWidth);
        }
      },
      (cause: unknown) => {
        note('holding', `no palette, so no ground is drawn: ${String(cause)}`);
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
        coordinates: fenceToPolygons(fenceFor(house, grid)),
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
                coordinates: fenceToPolygons(fenceFor(mine, grid)),
              },
            },
          ];
    source.setData({ type: 'FeatureCollection', features });
  }, [map, mine, everything, grid, fenceFor]);

  return null;
}

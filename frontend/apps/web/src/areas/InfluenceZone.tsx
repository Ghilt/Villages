import { useEffect, useMemo, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { areaAround, fenceToPolygons, seedOf } from '@villages/world';
import type { DiamondGrid, Fence } from '@villages/world';

import { note } from '../log/log';
import { terrainPalette } from '../geometry/terrainClasses';

/** The influence zone of one structure, as the map draws it: which, where it stands, and how far it reaches. */
export interface Zone {
  id: string;
  at: { lat: number; lon: number };
  /** How far its ground reaches, in world units on average: its type's, from the catalogue. */
  reach: number;
}

interface InfluenceZoneProps {
  map: maplibregl.Map | null;
  /** The selected structure's zone, or null when nothing selected has one: what is drawn. */
  zone: Zone | null;
  /** How far the ground's grid is turned, in degrees, which is how far a zone's diamonds are. */
  turn: number;
}

const SOURCE = 'influence-zone';
const SHADE = 'influence-zone-shade';
const LINE = 'influence-zone-line';

/** The gold of the interface: ground a structure reaches, rather than terrain or a line a player drew. */
const HELD = '#9d7c2a';

/**
 * How ragged a zone is: the reach wanders in and out by a quarter of itself on the way round, and every
 * diamond's distance is jittered by a diamond and a half, so the edge is a fraying, lumpy thing rather than
 * a circle. Always one piece with no holes, whatever these are. See `areaAround` and decision record 0066.
 */
const LUMPS = 0.25;
const JITTER = 1.5;

/**
 * A structure's **influence zone**, drawn while it is selected and never otherwise: a ground its type reaches,
 * unique to the type, and many types have none. What the ground means is not designed yet; for now the castle's
 * is the ragged gold ground every seat used to have drawn about it at all times, its reach the catalogue's.
 *
 * The shape is an **area** and nothing more - `areaAround`, the component anything fenced uses - seeded by the
 * structure, so its ground is the same shape on every screen that draws it. Headless, like the area overlay: it
 * owns one source and its two layers and renders nothing of its own. Drawn at every zoom, because it is drawn
 * only for the one thing the player has asked about. See docs/plans/structures.md and decision record 0093.
 */
export function InfluenceZone({ map, zone, turn }: InfluenceZoneProps) {
  const [width, setWidth] = useState<number | null>(null);
  const grid = useMemo((): DiamondGrid | null => (width === null ? null : { width, turn }), [width, turn]);
  // A structure never moves, and tracing a ring is not free, so a zone is traced once a structure and a turn.
  const fences = useRef(new Map<string, Fence>());

  useEffect(() => {
    let looking = true;
    terrainPalette().then(
      (palette) => {
        if (looking) {
          setWidth(palette.masterWidth);
        }
      },
      (cause: unknown) => {
        note('structures', `no palette, so no influence zone is drawn: ${String(cause)}`);
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
      paint: { 'fill-color': HELD, 'fill-opacity': 0.12 },
    });
    map.addLayer({
      id: LINE,
      type: 'line',
      source: SOURCE,
      paint: { 'line-color': HELD, 'line-opacity': 0.8, 'line-width': 1.5 },
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
    if (zone === null) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    const key = `${zone.id} ${grid.turn} ${zone.reach}`;
    let fence = fences.current.get(key);
    if (fence === undefined) {
      fence = areaAround({ lng: zone.at.lon, lat: zone.at.lat }, grid, zone.reach, {
        seed: seedOf(zone.id),
        lumps: LUMPS,
        jitter: JITTER,
      });
      fences.current.set(key, fence);
    }
    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: zone.id },
          geometry: { type: 'MultiPolygon', coordinates: fenceToPolygons(fence) },
        },
      ],
    });
  }, [map, zone, grid]);

  return null;
}

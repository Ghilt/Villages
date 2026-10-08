import { useEffect, useMemo, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';

import { fenceToPolygons } from '@villages/world';

import { PERIOD_MS } from '../areas/areaLayers';
import { circleOf } from '../fog/circles';
import { fieldOf } from '../fog/fogField';
import { note } from '../log/log';
import { sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';
import { isWaterKind } from './subjects';
import { pickedOf } from './waterPicked';
import { fenceOf } from './waterReach';
import { addRipple, removeRipple, rippleAlong } from './waterRipple';
import { watersStore } from './waters';

/**
 * The water a window is open on, fenced in gold on the map, as an area is fenced in its red: while that window is
 * the newest, all of what its click picked out - a river along its whole course, a lake within its shores, the sea
 * about the click - stepped along the master's own pixels rather than the diamonds the ground is drawn on, so that
 * turning the ground's grid never changes it. A flourish, read from the page's own tiles along where the server
 * says the water runs, and only on ground the house has revealed unless Adam's switch has lifted the fog. And a
 * click that names water sends a crackle of gold out along it, under the fence: see `waterRipple.ts`.
 */

const SOURCE = 'water-selection';
const WASH = 'water-selection-wash';
const GLOW = 'water-selection-glow';
const LINE = 'water-selection-line';

/** The light along the fence, and the deeper gold of the glow behind it and the wash within. */
const GILT = '#ffd96e';
const GILT_DEEP = '#e0a52c';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

interface WaterSelectionProps {
  map: maplibregl.Map | null;
  /** Where this page's tiles live, as the root of a URL. */
  worldRoot: string;
  /** What the map marks: the newest thing a window is open on, if any. */
  picked: { kind: string; id: string } | undefined;
}

export function WaterSelection({ map, worldRoot, picked }: WaterSelectionProps) {
  const waters = useStore(watersStore, (state) => state.seen);
  const clicked = useStore(watersStore, (state) => state.clicked);
  const sight = useStore(sessionStore, (state) => state.yourSight);
  const today = useStore(sessionStore, (state) => state.world?.today ?? null);
  const fogOn = useStore(sessionStore, (state) => state.fogOfWar);
  const seen = picked !== undefined && isWaterKind(picked.kind) ? waters.get(picked.id) : undefined;

  // What the house has revealed, as the fog is drawn from it; undefined with the fog lifted, where all may show.
  const tension = sight?.tension ?? 0;
  const field = useMemo(
    () =>
      fogOn
        ? fieldOf(
            (sight?.points ?? []).map((point) => circleOf(point, today, tension)),
            tension,
          )
        : undefined,
    [fogOn, sight, today, tension],
  );

  // What a ripple reads the ground by, as it is when the click comes, without a new one starting each time it changes.
  const ground = useRef({ worldRoot, field });
  ground.current = { worldRoot, field };

  // The ripple's light, then the source and the fence's lines over it, added once, as the areas' are.
  useEffect(() => {
    if (map === null) {
      return;
    }
    addRipple(map);
    map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: WASH,
      type: 'fill',
      source: SOURCE,
      paint: { 'fill-color': GILT_DEEP, 'fill-opacity': 0.12 },
    });
    map.addLayer({
      id: GLOW,
      type: 'line',
      source: SOURCE,
      paint: { 'line-color': GILT_DEEP, 'line-opacity': 0.6, 'line-width': 9, 'line-blur': 5 },
    });
    map.addLayer({
      id: LINE,
      type: 'line',
      source: SOURCE,
      paint: { 'line-color': GILT, 'line-opacity': 1, 'line-width': 2.4 },
    });
    return () => {
      for (const layer of [LINE, GLOW, WASH]) if (map.getLayer(layer) !== undefined) map.removeLayer(layer);
      if (map.getSource(SOURCE) !== undefined) map.removeSource(SOURCE);
      removeRipple(map);
    };
  }, [map]);

  // Each click that names water sends a ripple out along what it picked; the next click stops the last.
  useEffect(() => {
    if (map === null || clicked === null) {
      return;
    }
    const { worldRoot: root, field: revealed } = ground.current;
    let stop: (() => void) | null = null;
    let wanted = true;
    void pickedOf(clicked.seen, map.getZoom(), root, revealed).then((what) => {
      if (wanted) stop = rippleAlong(map, clicked.seen, what);
    });
    return () => {
      wanted = false;
      stop?.();
    };
  }, [map, clicked]);

  // The fence round what is picked, worked out when it is picked, at the zoom it was clicked at.
  useEffect(() => {
    const source = map?.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (map === null || source === undefined) {
      return;
    }
    if (seen === undefined) {
      source.setData(EMPTY);
      return;
    }
    let wanted = true;
    void pickedOf(seen, map.getZoom(), worldRoot, field).then(
      (what) => {
        const fence = fenceOf(what.grid, what.cells);
        const features: Feature[] =
          fence === null
            ? []
            : fenceToPolygons(fence).map((rings) => ({
                type: 'Feature',
                properties: {},
                geometry: { type: 'Polygon', coordinates: rings },
              }));
        if (wanted) source.setData({ type: 'FeatureCollection', features });
      },
      (cause: unknown) => {
        note(
          'inspect',
          `no fence round the water: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      },
    );
    return () => {
      wanted = false;
    };
  }, [map, seen, worldRoot, field]);

  // It breathes while it is shown, slowly, as a picked area does.
  useEffect(() => {
    if (map === null || seen === undefined) {
      return;
    }
    const started = performance.now();
    let frame = 0;
    const breathe = () => {
      const phase = 0.5 - 0.5 * Math.cos(((performance.now() - started) / PERIOD_MS) * Math.PI * 2);
      if (map.getLayer(GLOW) !== undefined) {
        map.setPaintProperty(GLOW, 'line-width', 6 + 8 * phase);
        map.setPaintProperty(GLOW, 'line-opacity', 0.45 + 0.4 * phase);
      }
      frame = requestAnimationFrame(breathe);
    };
    frame = requestAnimationFrame(breathe);
    return () => cancelAnimationFrame(frame);
  }, [map, seen]);

  return null;
}

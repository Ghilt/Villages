import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';

import { closePath, enclose, fenceAround, fenceToPolygons, insideFenceAt } from '@villages/world';
import type { DiamondGrid } from '@villages/world';

import { note } from '../log/log';
import { terrainPalette } from '../geometry/terrainClasses';
import { MOST_DIAMONDS } from './census';
import { inspect } from '../inspect/opening';
import { subjectsNow, watchSubjects } from '../inspect/subjects';
import { addArea, areasNow, armDrawing, watchAreas } from './areas';

/**
 * Areas on the map: the line, the shade, the pulse, and the drag that draws one.
 *
 * This is the only part of an area that knows what a map is. The geometry is pure and lives in
 * `@villages/world`; the state is a plain store; this turns a drag into a fence and a fence into layers.
 *
 * The fence is drawn as it is counted, along the ground's own diamonds: turned as far as the ground is,
 * one world unit each, the finest the ground is painted at. So at a close zoom the line runs along the
 * edges of the diamonds the terrain is drawn in, and tips and turns with them. A new area takes the turn
 * the ground has when it is drawn; one already drawn keeps the grid it was drawn on, which its fence
 * carries. The size the ground's cells are painted at never moves it. See docs/adr/0032 and 0066.
 */

interface AreaOverlayProps {
  map: maplibregl.Map | null;
  /** Where this page's tiles live, as the root of a URL, which is what a census reads. */
  worldRoot: string;
  /** How far the ground's grid is turned, in degrees, which is how far a new area's diamonds are. */
  turn: number;
}

const SOURCE = 'areas';
const SHADE = 'areas-shade';
const LINE = 'areas-line';
const PULSE = 'areas-pulse';

/**
 * The line as it is being drawn, before there is a fence to draw instead.
 *
 * Kept apart from the areas source because it is a different kind of thing: the raw drag, in longitude
 * and latitude, exactly where the hand went and snapped to nothing. Snapping is what makes a fence exact
 * and it is worth nothing while the hand is still moving, so it waits for the mouse to come up.
 */
const DRAFT = 'areas-draft';
const DRAFT_LINE = 'areas-draft-line';
const DRAFT_CLOSE = 'areas-draft-close';

/** Not a terrain colour and not the map's ink: an area is a thing a player drew, and says so. */
const FENCE = '#8f1d2f';

/** Slow enough to read as breathing rather than blinking. */
const PERIOD_MS = 2400;

/** How far the pointer must move before another point is taken. Screen pixels, so any zoom is the same. */
const SAMPLE_EVERY = 4;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export function AreaOverlay({ map, worldRoot, turn }: AreaOverlayProps) {
  const state = useSyncExternalStore(watchAreas, areasNow);
  // Which area breathes: whatever was opened last, if that was an area. The map marks one thing, and with
  // three windows up the newest is the one the player is looking at.
  const top = useSyncExternalStore(watchSubjects, subjectsNow).open[0];
  const pulsing = top?.kind === 'area' ? top.id : null;
  const [width, setWidth] = useState<number | null>(null);

  /** Read inside pointer handlers, which must see the grid without being rebuilt when it changes. */
  const gridRef = useRef<DiamondGrid | null>(null);
  useEffect(() => {
    gridRef.current = width === null ? null : { width, turn };
  }, [width, turn]);

  const drawing = useRef(false);
  const path = useRef<[number, number][]>([]);
  const lastAt = useRef<{ x: number; y: number } | null>(null);
  /** When a drag last ended, so that the click it becomes does not also select something. */
  const drewAt = useRef(0);

  // How wide world space is, which is the master's width and what turns a place into a diamond. Runtime
  // data rather than a constant, because which world is being drawn is a choice the browser makes. See
  // docs/adr/0025.
  useEffect(() => {
    let wanted = true;
    void terrainPalette().then(
      (palette) => {
        if (wanted) {
          setWidth(palette.masterWidth);
        }
      },
      (cause: unknown) => {
        note('area', `no world to measure against: ${cause instanceof Error ? cause.message : cause}`);
      },
    );
    return () => {
      wanted = false;
    };
  }, []);

  // The source and its layers, added once. `applyRenderer` swaps only its own painterly layer and never
  // reloads the style, so these are left alone from here on.
  useEffect(() => {
    if (map === null) {
      return;
    }
    map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: SHADE,
      type: 'fill',
      source: SOURCE,
      filter: ['==', ['get', 'shaded'], true],
      paint: { 'fill-color': FENCE, 'fill-opacity': 0.16 },
    });
    map.addLayer({
      id: LINE,
      type: 'line',
      source: SOURCE,
      paint: { 'line-color': FENCE, 'line-opacity': 0.85, 'line-width': 1.6 },
    });
    map.addLayer({
      id: PULSE,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['get', 'id'], ''],
      paint: { 'line-color': FENCE, 'line-opacity': 1, 'line-width': 2.6 },
    });

    // The draft, over everything, because while it is there it is the thing being looked at.
    map.addSource(DRAFT, { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: DRAFT_LINE,
      type: 'line',
      source: DRAFT,
      filter: ['==', ['get', 'closing'], false],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': FENCE, 'line-opacity': 0.9, 'line-width': 2 },
    });
    map.addLayer({
      id: DRAFT_CLOSE,
      type: 'line',
      source: DRAFT,
      filter: ['==', ['get', 'closing'], true],
      // Dashed, because this is the one piece of the shape the hand did not draw: it is where the ends
      // will be joined, shown while there is still time to put the hand somewhere else.
      paint: { 'line-color': FENCE, 'line-opacity': 0.45, 'line-width': 1.4, 'line-dasharray': [2, 2] },
    });

    return () => {
      // The map may already have been taken down, in which case it has no style to take layers out of.
      try {
        for (const layer of [DRAFT_CLOSE, DRAFT_LINE, PULSE, LINE, SHADE]) {
          if (map.getLayer(layer) !== undefined) {
            map.removeLayer(layer);
          }
        }
        for (const source of [DRAFT, SOURCE]) {
          if (map.getSource(source) !== undefined) {
            map.removeSource(source);
          }
        }
      } catch {
        // Nothing to undo.
      }
    };
  }, [map]);

  // What is drawn. Every area is a feature, its fence a multipolygon, because a fence may have pieces.
  // Each on the grid its own fence carries, so nothing here needs to know one.
  useEffect(() => {
    if (map === null) {
      return;
    }
    const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source === undefined) {
      return;
    }
    source.setData({
      type: 'FeatureCollection',
      features: state.areas.map((area) => ({
        type: 'Feature' as const,
        properties: { id: area.id, shaded: area.shaded },
        geometry: { type: 'MultiPolygon' as const, coordinates: fenceToPolygons(area.fence) },
      })),
    });
  }, [map, state.areas]);

  useEffect(() => {
    if (map === null || map.getLayer(PULSE) === undefined) {
      return;
    }
    map.setFilter(PULSE, ['==', ['get', 'id'], pulsing ?? '']);
  }, [map, pulsing]);

  // The pulse: plain numbers set on one layer that holds only the selected area, so nothing is
  // recompiled per frame and no other area is touched.
  useEffect(() => {
    if (map === null || pulsing === null) {
      return;
    }
    const set = (phase: number) => {
      if (map.getLayer(PULSE) === undefined) {
        return;
      }
      map.setPaintProperty(PULSE, 'line-opacity', 0.35 + 0.65 * phase);
      map.setPaintProperty(PULSE, 'line-width', 2 + 2.2 * phase);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      set(1);
      return;
    }

    let running = true;
    const started = performance.now();
    const beat = () => {
      if (!running) {
        return;
      }
      const turn = ((performance.now() - started) / PERIOD_MS) * Math.PI * 2;
      set(0.5 - 0.5 * Math.cos(turn));
      requestAnimationFrame(beat);
    };
    requestAnimationFrame(beat);
    return () => {
      running = false;
    };
  }, [map, pulsing]);

  // While armed the map does not move: the drag belongs to the area being drawn.
  useEffect(() => {
    if (map === null || !state.armed) {
      return;
    }
    map.dragPan.disable();
    map.doubleClickZoom.disable();
    const canvas = map.getCanvas();
    const was = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';

    return () => {
      map.dragPan.enable();
      map.doubleClickZoom.enable();
      canvas.style.cursor = was;
    };
  }, [map, state.armed]);

  // Drawing, from pointer events on the map's own container, so that a mouse and a finger take one path.
  //
  // MapLibre listens for mouse and touch events rather than pointer ones, so stopping propagation here
  // does not reach it. Three things do: `preventDefault` on `pointerdown`, which suppresses the mouse
  // events the browser would otherwise synthesise from it; `dragPan` disabled while armed, which is what
  // actually holds the camera still; and the moment a drag ended, remembered, so that the click it may
  // still become does not also select something.
  useEffect(() => {
    if (map === null) {
      return;
    }
    const container = map.getCanvasContainer();

    // Listened for on the canvas container, which is where MapLibre listens, but measured against the
    // map container, which is what `unproject` means by a point. They are not the same element: the
    // canvas container is statically positioned around an absolute canvas, so its own box collapses to
    // no height at all, and its corner agrees with the map's only by luck.
    const placeOf = (event: PointerEvent): [number, number] => {
      const rect = map.getContainer().getBoundingClientRect();
      const at = map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
      return [at.lng, at.lat];
    };

    /**
     * The drag so far, drawn where the hand actually went.
     *
     * Two features rather than one: what was drawn, and the segment that will join the ends, so that the
     * shape being made is visible before it is made. Set on every sample, which is every few screen
     * pixels, and a line of a few hundred points costs a map nothing.
     */
    const showDraft = (points: readonly [number, number][]) => {
      const draft = map.getSource(DRAFT) as maplibregl.GeoJSONSource | undefined;
      if (draft === undefined) {
        return;
      }
      const features: FeatureCollection['features'] = [];
      if (points.length >= 2) {
        features.push({
          type: 'Feature',
          properties: { closing: false },
          geometry: { type: 'LineString', coordinates: [...points] },
        });
      }
      if (points.length >= 3) {
        features.push({
          type: 'Feature',
          properties: { closing: true },
          geometry: { type: 'LineString', coordinates: [points[points.length - 1]!, points[0]!] },
        });
      }
      draft.setData({ type: 'FeatureCollection', features });
    };

    const clearDraft = () => {
      const draft = map.getSource(DRAFT) as maplibregl.GeoJSONSource | undefined;
      draft?.setData(EMPTY);
    };

    const abandon = () => {
      drawing.current = false;
      path.current = [];
      lastAt.current = null;
      clearDraft();
    };

    const finish = () => {
      const drawn = path.current;
      abandon();
      drewAt.current = performance.now();
      armDrawing(false);

      if (drawn.length < 3) {
        note('area', `only ${drawn.length} point(s), so nothing was drawn`);
        return;
      }
      const measuredOn = gridRef.current;
      if (measuredOn === null) {
        note('area', 'no world to measure against yet, so the area was dropped');
        return;
      }
      try {
        const fence = fenceAround(enclose(closePath(drawn), measuredOn, MOST_DIAMONDS));
        if (fence.parts.length === 0) {
          note('area', `${drawn.length} samples enclosed nothing`);
          return;
        }
        note('area', `drawn from ${drawn.length} samples`);
        addArea(fence, worldRoot);
      } catch (cause) {
        note('area', `not drawn: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
    };

    const onDown = (event: PointerEvent) => {
      if (!areasNow().armed || event.button !== 0) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      try {
        // Keeps the moves coming if the pointer leaves the map mid-drag. Worth having and not worth
        // failing over: a browser that refuses it still draws, it just stops sampling at the edge.
        container.setPointerCapture(event.pointerId);
      } catch {
        // Carry on without it.
      }
      drawing.current = true;
      path.current = [placeOf(event)];
      lastAt.current = { x: event.clientX, y: event.clientY };
    };

    const onMove = (event: PointerEvent) => {
      if (!drawing.current) {
        return;
      }
      event.stopPropagation();
      const from = lastAt.current;
      if (from !== null && Math.hypot(event.clientX - from.x, event.clientY - from.y) < SAMPLE_EVERY) {
        return;
      }
      lastAt.current = { x: event.clientX, y: event.clientY };
      path.current.push(placeOf(event));
      showDraft(path.current);
    };

    const onUp = (event: PointerEvent) => {
      if (!drawing.current) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      finish();
    };

    const onCancel = () => {
      if (drawing.current) {
        note('area', 'the drag was interrupted, so nothing was drawn');
        abandon();
        armDrawing(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !areasNow().armed) {
        return;
      }
      abandon();
      armDrawing(false);
    };

    container.addEventListener('pointerdown', onDown, true);
    container.addEventListener('pointermove', onMove, true);
    container.addEventListener('pointerup', onUp, true);
    container.addEventListener('pointercancel', onCancel, true);
    window.addEventListener('keydown', onKey);

    return () => {
      container.removeEventListener('pointerdown', onDown, true);
      container.removeEventListener('pointermove', onMove, true);
      container.removeEventListener('pointerup', onUp, true);
      container.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [map, worldRoot]);

  // Picking one. The hit test is the same even-odd test the count uses, on the diamond the click landed
  // in, so what is selected is what is drawn, and the smallest is preferred, or an area inside another
  // could never be chosen.
  useEffect(() => {
    if (map === null) {
      return;
    }
    const onClick = (event: maplibregl.MapMouseEvent) => {
      // A click that hit a house is that house's. The sprite overlay registers first and says so.
      if (event.defaultPrevented || areasNow().armed || performance.now() - drewAt.current < 300) {
        return;
      }
      const at = { lng: event.lngLat.lng, lat: event.lngLat.lat };
      const hit = [...areasNow().areas]
        .sort((one, other) => one.diamonds - other.diamonds)
        .find((area) => insideFenceAt(area.fence, at));
      // Empty ground closes nothing: a window is the player's to shut. Only a hit opens one.
      if (hit !== undefined) {
        inspect({ kind: 'area', id: hit.id });
      }
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  return null;
}

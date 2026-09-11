import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';

import { fromMercator, toMercatorExact } from '../sprites/cameraMath';

import { CAMERA, resolveStyle } from './mapConfig';
import { constrainCamera, floorZoom } from './sheet';

import 'maplibre-gl/dist/maplibre-gl.css';

type Constrain = NonNullable<maplibregl.MapOptions['transformConstrain']>;

interface MapViewProps {
  /** Where the world this page is drawing was cut to, as the root of a URL. See map/masters.ts. */
  worldRoot: string;
  /** Called once the map has a style and a camera, so that overlays can attach to it. */
  onReady?: (map: maplibregl.Map) => void;
}

/**
 * The map is the world, so it owns the camera and everything else follows it. This component is the only
 * place that talks to MapLibre imperatively; the rest of the interface reads state and draws over it.
 */
export function MapView({ worldRoot, onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const viewport = () => ({ width: container.clientWidth, height: container.clientHeight });

    // MapLibre asks this from inside its constructor, before `map` exists, so it may reach for the
    // container and nothing else. It replaces MapLibre's rule that the world must fill the window with
    // ours, under which the world may shrink to a sheet on the desk. See docs/adr/0033.
    const keepOnTheSheet: Constrain = (lngLat, zoom) => {
      const kept = constrainCamera({ centre: toMercatorExact(lngLat), zoom }, viewport(), CAMERA.maxZoom);
      const centre = fromMercator(kept.centre);
      return { center: new maplibregl.LngLat(centre.lng, centre.lat), zoom: kept.zoom };
    };

    const map = new maplibregl.Map({
      container,
      style: resolveStyle(import.meta.env, worldRoot),
      center: [CAMERA.center.lng, CAMERA.center.lat],
      zoom: CAMERA.initialZoom,
      minZoom: CAMERA.minZoom,
      maxZoom: CAMERA.maxZoom,
      transformConstrain: keepOnTheSheet,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      renderWorldCopies: false,
      attributionControl: { compact: false },
    });

    // The overlay projection assumes an unrotated, untilted camera, so every way a player could turn the
    // world is closed off here rather than left to the constructor alone. See docs/adr/0014.
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();

    // The wheel asks the rule above directly; the zoom-out button reads the minimum zoom to know when to
    // grey out, so it is told where the floor is, which moves with the window.
    const settleFloor = () => {
      const floor = floorZoom(viewport());
      if (map.getMinZoom() !== floor) {
        map.setMinZoom(floor);
      }
    };
    settleFloor();
    map.on('resize', settleFloor);

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    if (import.meta.env.DEV) {
      // A handle for the browser console and for the end-to-end tests, which assert on the camera.
      (window as unknown as { villagesMap?: maplibregl.Map }).villagesMap = map;
    }

    const announce = () => onReady?.(map);
    if (map.loaded()) {
      announce();
    } else {
      map.once('load', announce);
    }

    return () => {
      map.remove();
    };
  }, [worldRoot, onReady]);

  return <div className="map" ref={containerRef} data-testid="map" />;
}

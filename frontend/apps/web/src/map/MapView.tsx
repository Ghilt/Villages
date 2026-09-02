import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';

import { CAMERA, resolveStyleUrl } from './mapConfig';

import 'maplibre-gl/dist/maplibre-gl.css';

interface MapViewProps {
  /** Called once the map has a style and a camera, so that overlays can attach to it. */
  onReady?: (map: maplibregl.Map) => void;
}

/**
 * The map is the world, so it owns the camera and everything else follows it. This component is the only
 * place that talks to MapLibre imperatively; the rest of the interface reads state and draws over it.
 */
export function MapView({ onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const map = new maplibregl.Map({
      container,
      style: resolveStyleUrl(import.meta.env),
      center: [CAMERA.center.lng, CAMERA.center.lat],
      zoom: CAMERA.initialZoom,
      minZoom: CAMERA.minZoom,
      maxZoom: CAMERA.maxZoom,
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
  }, [onReady]);

  return <div className="map" ref={containerRef} data-testid="map" />;
}

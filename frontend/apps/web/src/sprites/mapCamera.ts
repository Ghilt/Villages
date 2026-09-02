import type * as maplibregl from 'maplibre-gl';

import type { CameraSource } from './SpriteRenderer';

/**
 * The map, seen as nothing but a camera. This is the only file that both the map and the renderer know
 * about, which is what keeps the renderer replaceable.
 */
export function cameraOf(map: maplibregl.Map): CameraSource {
  return {
    center: () => {
      const centre = map.getCenter();
      return { lng: centre.lng, lat: centre.lat };
    },
    zoom: () => map.getZoom(),
    size: () => {
      const container = map.getContainer();
      return { width: container.clientWidth, height: container.clientHeight };
    },
  };
}

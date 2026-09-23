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
    pitch: () => map.getPitch(),
    bearing: () => map.getBearing(),
    size: () => {
      const container = map.getContainer();
      return { width: container.clientWidth, height: container.clientHeight };
    },
    // `render` fires after MapLibre has drawn, so reading the camera here reads the one it just drew
    // with. `resize` is here too because the map's box can change without the window changing - the
    // stage folding into bays, a pane taking room - and the overlay has to hear about that.
    watch: (drawn) => {
      map.on('render', drawn);
      map.on('resize', drawn);
      return () => {
        map.off('render', drawn);
        map.off('resize', drawn);
      };
    },
  };
}

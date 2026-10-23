import type * as maplibregl from 'maplibre-gl';

import type { CameraView } from '../../geometry/cameraMath';

/** The map's camera as the spike's stage sees it. The ground under a point and back is `sprites/die/onTheGround.ts`. */

export function viewOf(map: maplibregl.Map): CameraView {
  const centre = map.getCenter();
  const box = map.getContainer();
  return {
    center: { lng: centre.lng, lat: centre.lat },
    zoom: map.getZoom(),
    width: box.clientWidth,
    height: box.clientHeight,
    pitch: map.getPitch(),
    bearing: map.getBearing(),
  };
}

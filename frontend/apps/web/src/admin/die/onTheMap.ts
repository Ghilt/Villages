import type * as maplibregl from 'maplibre-gl';

import { groundTilt, tiltGround, toMercatorExact, untiltGround, worldSize } from '../../geometry/cameraMath';
import type { CameraView, MercatorPoint, ScreenPoint } from '../../geometry/cameraMath';

/**
 * The map as the spike's stage sees it: its camera, and the ground under a point of the screen and back, by the
 * camera's own arithmetic, so the die is pinned to the same ground the map draws.
 */

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

export function screenOf(place: MercatorPoint, view: CameraView): ScreenPoint {
  const size = worldSize(view.zoom);
  const centre = toMercatorExact(view.center);
  const landed = tiltGround((place.x - centre.x) * size, (place.y - centre.y) * size, groundTilt(view));
  return { x: landed.x + view.width / 2, y: landed.y + view.height / 2 };
}

export function mercatorOf(point: ScreenPoint, view: CameraView): MercatorPoint {
  const size = worldSize(view.zoom);
  const centre = toMercatorExact(view.center);
  const ground = untiltGround(point.x - view.width / 2, point.y - view.height / 2, groundTilt(view));
  return { x: centre.x + ground.east / size, y: centre.y + ground.south / size };
}

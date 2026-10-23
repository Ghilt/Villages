import { groundTilt, tiltGround, toMercatorExact, untiltGround, worldSize } from '../../geometry/cameraMath';
import type { CameraView, MercatorPoint, ScreenPoint } from '../../geometry/cameraMath';

/**
 * The ground under a point of the screen, and where a point of the ground is on it, by the camera's own arithmetic,
 * so the die is pinned to the same ground the map draws.
 */

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

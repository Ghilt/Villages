import { cellOf } from '@villages/world';

import * as camera from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';

/** The cells a view stands on, inclusive, with a ring of `ring` cells about it. */
export interface ViewCells {
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
}

/**
 * Which cells the view stands on, in world units, with a ring so a pan finds them cut.
 *
 * Tilted, the ground under the window is a turned rectangle stretched along the lean, so the window's four corners
 * are carried back onto the ground through the same tilt that placed the feet, which is exact at any angle and the old
 * arithmetic exactly when the camera is flat and north-up.
 */
export function viewCells(
  view: camera.CameraView,
  centre: { x: number; y: number },
  scale: number,
  tilt: camera.GroundTilt,
  ring: number,
): ViewCells {
  const halfWide = view.width / 2 / scale;
  const halfHigh = view.height / 2 / scale;
  const corners = [
    [-halfWide, -halfHigh],
    [halfWide, -halfHigh],
    [-halfWide, halfHigh],
    [halfWide, halfHigh],
  ].map(([x = 0, y = 0]) => camera.untiltGround(x, y, tilt));
  const eastUnits = corners.map(({ east }) => centre.x * WORLD_MASTER_WIDTH + east);
  const southUnits = corners.map(({ south }) => centre.y * WORLD_MASTER_WIDTH + south);
  return {
    fromX: cellOf(Math.min(...eastUnits)) - ring,
    toX: cellOf(Math.max(...eastUnits)) + ring,
    fromY: cellOf(Math.min(...southUnits)) - ring,
    toY: cellOf(Math.max(...southUnits)) + ring,
  };
}

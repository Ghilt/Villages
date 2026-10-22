import type { Graphics } from 'pixi.js';

import { fromMercator, worldSize } from '../../geometry/cameraMath';
import type { CameraView, MercatorPoint, ScreenPoint } from '../../geometry/cameraMath';

/**
 * The landing circle as the spike draws it: a ring on the ground round the die, `km` wide, breathing, and flaring by
 * `flash` as the die comes to rest. The game draws it with the selection ring's own shader, a later step of
 * `docs/plans/choice-roll-podium.md`; this is a few strokes standing in for it.
 */

const EARTH_KM = 40075.016686;

export function drawLandingCircle(
  ring: Graphics,
  ground: ScreenPoint,
  view: CameraView,
  place: MercatorPoint,
  km: number,
  t: number,
  flash: number,
): void {
  const lat = fromMercator(place).lat;
  const radius = (km * worldSize(view.zoom)) / (EARTH_KM * Math.cos((lat * Math.PI) / 180));
  const lean = Math.cos(((view.pitch ?? 0) * Math.PI) / 180);
  const breath = 0.55 + 0.25 * Math.sin((t / 2400) * Math.PI * 2) + flash;
  ring.clear();
  for (const [width, alpha] of [
    [14, 0.07],
    [8, 0.14],
    [3, 0.55],
  ] as const) {
    ring
      .ellipse(ground.x, ground.y, radius, radius * lean)
      .stroke({ width, color: 0xf6d77a, alpha: Math.min(1, alpha * breath * 1.6) });
  }
}

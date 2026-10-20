import type { CameraView } from '../geometry/cameraMath';

import type { createFogLayer } from './FogLayer';
import type { Layer } from './layer';

/** Twelve frames a second: all a haze moving about a unit a second needs, and a fifth of what a display draws. */
const UNDULATION_MS = 83;

/**
 * The fog as a layer of the renderer's stack, and the haze's slow clock with it: one frame at a time, twelve a second,
 * while there is haze on the screen to move and none otherwise. Still for anyone who has asked for less motion. See
 * step 7 of docs/plans/fog-of-war.md.
 */
export function createHazeLayer(fog: ReturnType<typeof createFogLayer>): Layer {
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    draw(view: CameraView, now: number): number | null {
      fog.follow(view);
      if (still) {
        return null;
      }
      fog.setTime(now / 1000);
      return fog.undulates(view) ? UNDULATION_MS : null;
    },
    destroy: () => fog.destroy(),
  };
}

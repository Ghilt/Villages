import type { CameraView } from '../geometry/cameraMath';

/**
 * One layer of the sprite canvas: the marks, the fog, the scenery, the colour taken out of the map.
 *
 * The renderer stacks the layers in its one stage, bottom to top, draws every one each frame from the same
 * camera into the same browser frame, and asks for the next frame as soon as the soonest of them wants one. A
 * layer says what it wants by what `draw` hands back, so a new layer is a module of its own and a line in the
 * renderer's stack rather than a branch through its frame. See ARCHITECTURE's "The sprite canvas is a stack of
 * layers".
 */
export interface Layer {
  /**
   * Draws this frame, for this camera, at this time: `elapsed` is how far the frame moves a change on, capped so
   * a still map's long silence does not arrive as one step. Hands back how many milliseconds until it wants
   * another frame - nought for the next one the browser draws - or null for none.
   */
  draw(view: CameraView, now: number, elapsed: number): number | null;
  /** Lets go of what it holds. */
  destroy(): void;
}

/** The soonest of two wants: whichever wants a frame first, or null when neither wants one. */
export function soonest(one: number | null, other: number | null): number | null {
  if (one === null) return other;
  if (other === null) return one;
  return Math.min(one, other);
}

import type { CameraView } from '../../geometry/cameraMath';
import type { Layer } from '../layer';
import type { SceneryHow } from '../SpriteRenderer';
import { noteDrawn } from './sceneryCells';
import type { createSceneryLayer } from './SceneryLayer';

type SceneryLayer = ReturnType<typeof createSceneryLayer>;

/**
 * The world's furniture as a layer of the renderer's stack: shown or hidden by its switch, grown for the view by the
 * dial and spacing it is handed, and said in the panel with the worst gap between two frames of a moving map, which
 * is what a stutter is. It asks for its own frames as the cells it cuts land.
 */
export function createSceneryDrawing(
  scenery: () => SceneryLayer | null,
  how: () => SceneryHow,
  drawSoon: () => void,
): Layer {
  /** The worst gap between two frames of a moving map. */
  let worstGapMs = 0;
  /** When the last frame was actually drawn, which is what a frame gap is measured between. */
  let lastDrawnAt = 0;

  return {
    draw(view: CameraView, now: number): number | null {
      const layer = scenery();
      if (layer === null) {
        return null;
      }
      const asked = how();
      layer.container.visible = asked.on;
      const drew = asked.on
        ? layer.update(
            view,
            asked.tilesRoot,
            asked.dial,
            asked.spacing,
            asked.laterBy,
            asked.shadows,
            drawSoon,
          )
        : { particles: 0, shadows: 0, showing: 0, cells: 0, waiting: 0 };
      // Only gaps short enough to be a moving map are counted. A still map draws nothing, so the gap
      // since its last frame is seconds, and reporting that as a frame gap would be the panel lying
      // about a stall that never happened. See decision record 0023.
      const gap = now - lastDrawnAt;
      lastDrawnAt = now;
      if (gap > 0 && gap < 200) {
        worstGapMs = Math.max(worstGapMs, gap);
        noteDrawn({ ...drew, frameGapMs: gap, worstGapMs });
      } else {
        noteDrawn(drew);
      }
      return null;
    },
    destroy: () => scenery()?.destroy(),
  };
}

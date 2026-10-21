/*
 * When the sprites' canvas draws next. A frame is asked for, however often it is asked before it comes: what every
 * change on the canvas does - a mark, the ring, the fog, the scenery - and a trade still running. The map may not be
 * moving, so its `render` may not be coming. A still map with nothing changing on it still draws nothing, and thirty
 * cells answered in one burst draw once rather than a frame a setter a cell. Beside it, the haze's slow clock: one frame
 * at a time, twelve a second, while there is haze on the screen to move and none otherwise; nothing else on the map has
 * a clock of its own, and it is still for anyone who has asked for less motion. See step 7 of
 * docs/plans/fog-of-war.md.
 */

export interface FrameClock {
  /** Asks for one frame, on the next animation frame. */
  soon(): void;
  /** Asks for a frame this many milliseconds from now: the haze's twelve a second. */
  after(ms: number): void;
  /** Whether the haze's clock is running: a frame asked for later. */
  undulating(): boolean;
  /** Draws no frame again, and drops any asked for. */
  stop(): void;
}

export function createFrameClock(frame: () => void): FrameClock {
  /** A frame owed: asked for, and not yet drawn. The camera may not be moving, so nobody else will ask. */
  let owed: number | null = null;
  let undulation: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  return {
    soon(): void {
      if (owed !== null || stopped) return;
      owed = requestAnimationFrame(() => {
        owed = null;
        frame();
      });
    },
    after(ms: number): void {
      if (undulation !== null || stopped) return;
      undulation = setTimeout(() => {
        undulation = null;
        frame();
      }, ms);
    },
    undulating: () => undulation !== null,
    stop(): void {
      stopped = true;
      if (undulation !== null) clearTimeout(undulation);
      if (owed !== null) cancelAnimationFrame(owed);
      undulation = null;
      owed = null;
    },
  };
}

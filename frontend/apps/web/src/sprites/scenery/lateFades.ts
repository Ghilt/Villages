import { easeTowards } from '../twoForms';

/**
 * How long a wood built after the woods have arrived takes to fade in on its own: slower than the arrival, so it
 * reads as a wood coming rather than appearing. Built late, it came in whole in one frame (2026-10-22).
 */
export const LATE_FADE_MS = 300;

/** The woods built while the woods were already showing, each fading in by a clock of its own. */
export interface LateFades<Cell> {
  /** A cell's group was built late: it starts from nought. */
  start(cell: Cell, group: number): void;
  /** How far a cell's group has faded in: whole unless it was built late and is still coming. */
  of(cell: Cell, group: number): number;
  /**
   * Moves every late group on by the frame and hands each one's fade to `write`; says whether any is still coming.
   */
  step(elapsed: number, write: (cell: Cell, group: number, fade: number) => void): boolean;
  /** A cell's group, or the whole cell, is gone: nothing of it fades any more. */
  forget(cell: Cell, group?: number): void;
  clear(): void;
}

export function createLateFades<Cell>(): LateFades<Cell> {
  const fading = new Map<Cell, Map<number, number>>();
  return {
    start(cell, group) {
      let groups = fading.get(cell);
      if (groups === undefined) fading.set(cell, (groups = new Map()));
      groups.set(group, 0);
    },
    of: (cell, group) => fading.get(cell)?.get(group) ?? 1,
    step(elapsed, write) {
      for (const [cell, groups] of fading) {
        for (const [group, was] of groups) {
          const fade = easeTowards(was, 1, elapsed, LATE_FADE_MS);
          write(cell, group, fade);
          if (fade >= 1) groups.delete(group);
          else groups.set(group, fade);
        }
        if (groups.size === 0) fading.delete(cell);
      }
      return fading.size > 0;
    },
    forget(cell, group) {
      if (group === undefined) {
        fading.delete(cell);
        return;
      }
      const groups = fading.get(cell);
      groups?.delete(group);
      if (groups?.size === 0) fading.delete(cell);
    },
    clear: () => fading.clear(),
  };
}

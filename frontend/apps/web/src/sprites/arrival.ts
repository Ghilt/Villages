import { BECOMES_A_MARK_AT, CROSSFADE_MS, CROSSOVER_STICK, easeTowards, midTrade } from './twoForms';

/*
 * The **real world** arriving on the map and leaving it: whatever the land holds - the roads and their roadside, the
 * bridges, the worn ground, as the scenery and the structures standing do - comes in at the one zoom the map changes
 * over at, `BECOMES_A_MARK_AT`, and goes there, the zoom deciding whether and time how long, as a mark's two forms
 * trade (`twoForms.ts`). Never across a band of zoom, which leaves a camera resting inside it a half-drawn world. The
 * **info layer** - the marks, the fog, the areas - keeps to zooms of its own. See decision record 0096, amended
 * 2026-10-22.
 */

/** Whether the real world belongs on the screen at a zoom, given whether it is there now: a little sticky either way. */
export function realWorldWanted(zoom: number, there: boolean): boolean {
  return there ? zoom >= BECOMES_A_MARK_AT - CROSSOVER_STICK : zoom >= BECOMES_A_MARK_AT + CROSSOVER_STICK;
}

/** One layer's share of the real world's arrival: how much of it is drawn, frame by frame. */
export interface Arrival {
  /** How much is drawn this frame, nought to one, moved on by how long the frame was. */
  step(zoom: number, elapsed: number): number;
  /** What the layer hands back for another frame: nought while part-way in or out, null once landed. */
  wants(): number | null;
}

export function createArrival(): Arrival {
  let there = false;
  let drawn = 0;
  return {
    step(zoom: number, elapsed: number): number {
      there = realWorldWanted(zoom, there);
      drawn = easeTowards(drawn, there ? 1 : 0, elapsed, CROSSFADE_MS);
      return drawn;
    },
    wants: () => (midTrade(drawn) ? 0 : null),
  };
}

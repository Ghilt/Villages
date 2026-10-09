import { BAR_THICKNESS } from '../ui/bar/bar';
import type { Asking, BayLayout, Box, Form, Rect, SpreadWants } from './bayBox';
import { bayLayout, formFor } from './bayBox';

/**
 * The stage laid out with the **bottom bar** on a phone: the bar is carved off the stage's far edge - along the
 * bottom upright, down the right turned - and the two bays are cut from what it leaves, so nothing in the
 * bays' arithmetic had to learn that it is there. In the spread there is no bar. See decision record 0109.
 *
 * The bar goes where the phone is held: along the bottom when the stage is at least as tall as it is wide, and
 * down the right otherwise. Within a bar's thickness of square the bays may then be cut the other way from the
 * bar, which is a phone nobody holds; the bar says which way it runs from its own shape.
 */

/** How thick the bar is: the library's, a strip, so the bar is a thumb across as a pane put away is. */
export const BAR = BAR_THICKNESS;

export interface StageLayout extends BayLayout {
  /** Where the bottom bar stands, or null in the spread. */
  bar: Rect | null;
}

export function stageLayout(
  stage: Box,
  asking: readonly [Asking, Asking],
  wants: SpreadWants,
  was: Form,
): StageLayout {
  if (formFor(stage, was) !== 'bays') {
    return { ...bayLayout(stage, asking, wants, was), bar: null };
  }
  const upright = stage.h >= stage.w;
  const left: Box = upright
    ? { w: stage.w, h: Math.max(0, stage.h - BAR) }
    : { w: Math.max(0, stage.w - BAR), h: stage.h };
  const bar: Rect = upright
    ? { x: 0, y: left.h, w: stage.w, h: stage.h - left.h }
    : { x: left.w, y: 0, w: stage.w - left.w, h: stage.h };
  // What the bar leaves is never wider or taller than the stage, so it folds no later than the stage did.
  return { ...bayLayout(left, asking, wants, 'bays'), bar };
}

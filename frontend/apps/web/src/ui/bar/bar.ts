import { stepTo } from '../tabs/tabs';

/**
 * A bar's arithmetic: how thick it is, which of its buttons the keyboard stops on, and where the arrow keys
 * take it from there. Pure, so that a button the keys skip is a test. See docs/UI-COMPONENTS.md.
 */

/**
 * How thick the bottom bar is, across it, in pixels: a thumb, which is what the game's strip is, so the bar
 * is exactly as thick as the pane it stands in for when that pane is put away.
 */
export const BAR_THICKNESS = 44;

/** Which way a bar runs: along the bottom of what it stands under, or down the side of what it stands beside. */
export type BarAlong = 'across' | 'down';

/**
 * The one button of the bar that Tab stops on: the chosen one, or the first that can be pressed when none
 * is, so the bar is one stop and not five. Null when nothing in it can be pressed.
 */
export function stopOf(enabled: readonly boolean[], chosen: number): number | null {
  if (enabled[chosen] === true) {
    return chosen;
  }
  const first = enabled.indexOf(true);
  return first === -1 ? null : first;
}

/**
 * The button the keyboard moves to from the one it is on, for the key pressed, or null for a key that is
 * not a bar's. Either pair of arrows steps along it whichever way it runs, coming round at the ends, so a
 * bar turned on its side is worked the same way; Home and End go to the ends. A button that cannot be
 * pressed is passed over. It moves the keyboard and presses nothing: what a button does is Enter's.
 */
export function stepAlong(from: number, key: string, enabled: readonly boolean[]): number | null {
  const along = key === 'ArrowDown' ? 'ArrowRight' : key === 'ArrowUp' ? 'ArrowLeft' : key;
  return stepTo(from, along, enabled);
}

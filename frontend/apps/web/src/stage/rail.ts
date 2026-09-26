import type { PaneSize } from './panes';

/**
 * The rail out of room: which of the panes stacked on it are put away so that one stays open.
 *
 * The rail is the spread's **left** bay, and its panes stack one under another, all of them drawn. When
 * they no longer all fit, squeezing each of them to a sliver makes none of them readable, so **every one
 * but one is put away**: the top one that the player has not put away themselves, which is the newest, or
 * the one they just opened, because opening a put-away pane brings it to the top. Opening another then
 * puts the rest away in turn, so a rail out of room only ever has one pane open.
 *
 * Put away is written into what each pane asked for rather than worked out on every render, so nothing
 * reopens by itself when room comes back: a pane the rail put away stays put away until the player opens
 * it, the same as one they put away themselves. See decision record 0058.
 *
 * Pure. The heights come from the page, because what a pane is drawn at depends on what it says, and the
 * stage measures them; see `Stage.tsx`.
 */

export interface Stacked {
  id: string;
  /** What the player asked it to be, which a put-away pane keeps. */
  asked: PaneSize;
  /** How tall it is drawn at that size, measured, whether or not the rail has room for it. */
  tall: number;
}

/**
 * The panes to put away, given the rail's height and the air between one pane and the next. Empty when
 * everything fits, or when only one is open and there is nothing left to put away.
 *
 * `stacked` is in the order they stand, top first.
 */
export function outOfRoom(stacked: readonly Stacked[], room: number, gap: number): readonly string[] {
  const needs = stacked.reduce((sum, one) => sum + one.tall, 0) + gap * Math.max(0, stacked.length - 1);
  if (needs <= room) {
    return [];
  }
  const open = stacked.filter((one) => one.asked !== 'strip');
  return open.slice(1).map((one) => one.id);
}

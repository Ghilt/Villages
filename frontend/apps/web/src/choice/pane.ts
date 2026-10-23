import type { Pane } from '../stage/panes';

/**
 * **The choice roll**: what the world is asking, and the options it is offering.
 *
 * Always there once there is a house or a question: at rest it is **Take action**, the die on its podium that provokes
 * a roll, put away to its strip so that the map runs nearly to the bottom of the stage; a hand dealt, or a question
 * asked, opens it, and answering puts it back to its strip. Before the house is founded and with nothing asked,
 * it is not there at all. See decision record 0083.
 *
 * Full is the options laid out to read through; small is the **carousel**, one option at a time, for
 * glancing at them while looking at the map they are about, on a phone; minimised is the letter set aside. In
 * the spread there is no small: put away it is a chip in the middle of the bottom row, and opened out it lies
 * over everything with a veil under it. See `MECHANICS.md` and decision records 0044, 0046 and 0085.
 */
export const CHOICE_PANE: Pane = {
  id: 'choice',
  title: 'a letter',
  spread: 'bottomMiddle',
  // One height, because in the spread it is put away to its chip or opened out over everything, and nothing
  // between: Adam's word of 2026-10-06, decision record 0085. Opened out it is three times what the middle
  // size was, a rolled hand's omens on top and its options along the bottom, covering most of the middle of
  // the screen (Adam's word of 2026-10-05); the layout caps it at the stage. Measured against the founding
  // choice's wordiest option rather than picked, because an option that does not fit grows a scrollbar
  // inside a sheet of parchment, which is not what parchment does.
  tall: { full: 768, small: 768 },
  icon: 'letter',
  // Three options across a wide bay, or three down a tall one. A bay that is neither - half a phone - gets
  // the carousel, which is the whole answer to a row that has run out of room: the pane draws itself
  // smaller. Opened out in the spread it is always wide enough.
  needs: { wide: 544, tall: 460 },
  startsAt: 'strip',
  spreadSizes: ['strip', 'full'],
};

/**
 * **The choice roll at rest**: Take action, with nothing asked. The same pane by the same id, so the size it was
 * asked for carries across when a hand arrives, but opened out on a desktop only as tall as what it says - the
 * button and what a roll costs - rather than a box over most of the screen with one button in the middle of it.
 * 256, what the letter's middle size was. See decision record 0085.
 */
export const CHOICE_AT_REST: Pane = { ...CHOICE_PANE, tall: { full: 256, small: 256 } };

import type { Pane } from '../stage/panes';

/**
 * **The choice roll**: what the world is asking, and the options it is offering.
 *
 * Always there once there is a house or a question: at rest it is **Take action**, the button that provokes a
 * roll, put away to its strip so that the map runs nearly to the bottom of the stage; a hand dealt, or a question
 * asked, opens it, and answering puts it back to its strip. Before the house is founded and with nothing asked,
 * it is not there at all. See decision record 0083.
 *
 * Full is the options laid out to read through; small is the **carousel**, one option at a time, for
 * glancing at them while looking at the map they are about; minimised is the letter set aside. It was the
 * one pane whose size was the **player's** rather than the layout's, and since 0046 every pane's is: a
 * phone's three arrangements are the player's to pick and nobody's to derive. See `MECHANICS.md` and
 * decision records 0044 and 0046.
 */
export const CHOICE_PANE: Pane = {
  id: 'choice',
  title: 'a letter',
  spread: 'bottomMiddle',
  // The same at both sizes, because a tile too narrow for three across draws the carousel in it and the
  // tile's height does not change when that happens. Measured against the founding choice's wordiest
  // option rather than picked, because an option that does not fit grows a scrollbar inside a sheet of
  // parchment, which is not what parchment does. 256 since the letter has had its frame of clouds, whose
  // corners take 27 at the top and the bottom that a box of parchment did not.
  //
  // Opened out on a desktop it is three times that, Adam's word of 2026-10-05: a rolled hand's omens on top and its
  // options along the bottom, covering most of the middle of the screen; the layout caps it at the stage. The
  // middle size is the one it always had, the omens folded to their marks over the options.
  tall: { full: 768, small: 256 },
  icon: 'letter',
  // Three options across a wide tile, or three down a tall bay. A bay that is neither - the bottom middle
  // of a small spread - gets the carousel, which is the whole answer to a row that has run out of room:
  // the pane draws itself smaller, and the form does not change because a tile got tight.
  needs: { wide: 544, tall: 460 },
  startsAt: 'strip',
};

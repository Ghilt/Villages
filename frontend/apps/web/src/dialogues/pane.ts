import type { Pane } from '../stage/panes';

/**
 * **Character dialogue**: the conversations the house has been offered, and the one being read.
 *
 * It stands from the first dialogue a house is offered, and is never closed after that, because the ones
 * finished are kept to be read back. In the spread it takes the column down the right edge, which is
 * wider than the one on the left so that a picture of where a conversation is happening fits at its top,
 * and it opens at its normal width rather than at half the stage. On a phone it is a pane like any other.
 * See `MECHANICS.md` and decision records 0071 and 0069.
 */
export const DIALOGUE_PANE: Pane = {
  id: 'dialogues',
  title: 'dialogues',
  spread: 'right',
  // The column's width is the layout's, as the left column's is, so the pane asks for no height of its own.
  tall: null,
  icon: 'speech',
  needs: null,
  startsAt: 'small',
};

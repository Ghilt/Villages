import type { Pane } from '../stage/panes';

/**
 * **Challenges**: the challenge a quest puts to the house, chosen for and accepted here, and every one the house has
 * fought. In the spread it takes turns with the dialogues and the quests in the column down the right edge, its tab a
 * mark; on a phone it is a pane like any other, below the map. Its place is for now, until the bays are reworked. See
 * `MECHANICS.md`, Challenge, and decision record 0107, amended.
 */
export const CHALLENGE_PANE: Pane = {
  id: 'challenges',
  title: 'challenges',
  spread: 'right',
  // The column's width is the layout's, and its size the column's whichever tab is up, so it asks for nothing.
  tall: null,
  icon: 'challenges',
  needs: null,
  startsAt: 'small',
};

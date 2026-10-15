import type { Pane } from '../stage/panes';

/**
 * **Quests**: the quests the house has been offered, and the one whose map is open.
 *
 * It stands from the first quest a house is offered, and is never closed after that, because the ones finished are
 * kept to be looked back on. In the spread it takes turns with the dialogues in the column down the right edge, its
 * tab a mark, Adam's word of 2026-10-15; on a phone it is a pane like any other. See `MECHANICS.md` and decision
 * record 0096.
 */
export const QUEST_PANE: Pane = {
  id: 'quests',
  title: 'quests',
  spread: 'right',
  // The column's width is the layout's, and its size the column's whichever tab is up, so it asks for nothing.
  tall: null,
  icon: 'quests',
  needs: null,
  startsAt: 'small',
};

import type { Pane } from '../stage/panes';

/**
 * **Holdings**: every structure the house holds, its seat first, as a list.
 *
 * A tab of the corner beside the key figures, because what the house holds is its own as whom it holds is, and a
 * player reaches it the way they reach the house; its mark the tower a structure is known by everywhere. See
 * `MECHANICS.md` and docs/plans/structures.md.
 */
export const HOLDINGS_PANE: Pane = {
  id: 'holdings',
  title: 'holdings',
  spread: 'bottomLeft',
  tall: null,
  icon: 'tower',
  needs: null,
};

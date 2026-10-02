import type { Pane } from '../stage/panes';

/**
 * **Key figures**: the few named people the house acts through, as a grid of their portraits.
 *
 * The corner's middle tab, between the house status and navigation, because it is the house's own and a
 * player reaches it the way they reach the house. The corner is one size whichever tab is up, so pressing
 * between them moves nothing; opened out it is taller and wider than the column, and that size is the
 * one this pane's details need, the portrait beside the name and the stats. See `CORNER`, `MECHANICS.md`
 * and decision records 0055 and 0057.
 */
export const KEY_FIGURES_PANE: Pane = {
  id: 'key-figures',
  title: 'key figures',
  spread: 'bottomLeft',
  tall: null,
  icon: 'figure',
  needs: null,
};

import type { Pane } from '../stage/panes';

/** **The house status**: the house's own card, in the corner. See `HouseStatus`. */
export const HOUSE_PANE: Pane = {
  id: 'house',
  title: 'your house',
  // Into the bottom-left corner, cut off by two of the stage's own edges, as the card always was.
  spread: 'bottomLeft',
  // The corner's size rather than the card's own, and the corner's normal height is this card's full one.
  // See `CORNER`.
  tall: null,
  icon: 'shield',
  needs: null,
};

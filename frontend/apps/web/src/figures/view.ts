import type { KeyFigureView } from '@villages/protocol';

/**
 * What the key figures pane shows, and which figure it has open: pure, so the rules have a test.
 *
 * **None** is the empty words. **One** is their details, with no way back, because a grid of one is a
 * button that opens the only thing there is. **Two or more** is the grid, until one is pressed, and then
 * their details with the nine squares to go back by. The open figure is the pane's own state, which
 * survives the tabs because a pane is never unmounted. See decision record 0055.
 */
export type FiguresView =
  | { kind: 'empty' }
  | { kind: 'grid'; figures: readonly KeyFigureView[] }
  | { kind: 'details'; figure: KeyFigureView; back: boolean };

/**
 * Which figure stays open as the list changes under the pane.
 *
 * A lone figure is open, whether or not anyone pressed them, so a second arriving leaves the first open
 * with a way back rather than snatching the details away. An open figure who leaves - dead, or let go -
 * closes: the grid comes back, or the one who is left, or the empty words.
 */
export function stillOpen(figures: readonly KeyFigureView[], open: string | null): string | null {
  if (figures.length === 1) {
    return figures[0]!.id;
  }
  return open !== null && figures.some((figure) => figure.id === open) ? open : null;
}

/** What the pane shows, given the figures in the order they joined and the one that is open. */
export function viewOf(figures: readonly KeyFigureView[], open: string | null): FiguresView {
  if (figures.length === 0) {
    return { kind: 'empty' };
  }
  const opened = figures.find((figure) => figure.id === stillOpen(figures, open));
  return opened === undefined
    ? { kind: 'grid', figures }
    : { kind: 'details', figure: opened, back: figures.length > 1 };
}

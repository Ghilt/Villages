/**
 * Where a scroll area's view is in what it holds: whether there is more out of sight before it and after
 * it, which is what its faded edges say. Pure, so that when an edge fades is a test.
 */

export interface Edges {
  /** There is more above, or to the left. */
  readonly before: boolean;
  /** There is more below, or to the right. */
  readonly after: boolean;
}

/**
 * Less than this is not more to scroll to: a zoomed screen leaves a scroll that has reached its end a
 * fraction of a pixel short of it.
 */
const SLACK = 1;

/** Given how far it is scrolled, how much of it is in view, and how much there is in all. */
export function edgesOf(scrolled: number, inView: number, whole: number): Edges {
  return { before: scrolled > SLACK, after: scrolled + inView < whole - SLACK };
}

/** The edges as the stylesheet reads them, a word for each that has more beyond it: `before after`. */
export function moreOf(edges: Edges): string {
  return [edges.before ? 'before' : '', edges.after ? 'after' : ''].filter((one) => one !== '').join(' ');
}

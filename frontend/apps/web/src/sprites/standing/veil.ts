import { easeTowards } from '../twoForms';

/*
 * The trees faded most of the way out of the way of what the pointer is over, so a castle or a person behind a wood
 * can be seen and the wood is still there. Each tree's own alpha is kept and the fade laid over it, so the scenery's
 * own fades - a cell arriving, a zoom past where the trees come in - still reach a tree that is faded, and it comes
 * back to just what the scenery says.
 */

/** How much of a tree is left in the way of what the pointer is over: faded seven tenths, Adam's. */
export const FADED = 0.3;
/**
 * How long a fade from whole to nothing would take, in milliseconds, so the seven tenths a tree fades out of the way
 * take about seven tenths of a second, and as long to come back: slow enough to watch it go.
 */
export const FADE_MS = 1000;

/** Anything that has an alpha to fade: a particle of the scenery. */
export interface Fadeable {
  alpha: number;
}

export interface Veil<T extends Fadeable> {
  /**
   * Moves every tree in the way towards faded and every other one it faded back towards whole, by the clock, and says
   * whether any is still on its way.
   */
  step(inTheWay: ReadonlySet<T>, elapsed: number): boolean;
}

export function createVeil<T extends Fadeable>(): Veil<T> {
  /** Each tree faded: how far, its own alpha under the fade, and the alpha last written, to tell when the scenery wrote. */
  const faded = new Map<T, { veil: number; own: number; written: number }>();
  return {
    step(inTheWay, elapsed) {
      for (const tree of inTheWay) {
        if (!faded.has(tree)) faded.set(tree, { veil: 1, own: tree.alpha, written: tree.alpha });
      }
      let moving = false;
      for (const [tree, one] of faded) {
        // The scenery faded it in or out since: that is its own alpha now.
        if (tree.alpha !== one.written) one.own = tree.alpha;
        const towards = inTheWay.has(tree) ? FADED : 1;
        one.veil = easeTowards(one.veil, towards, elapsed, FADE_MS);
        if (one.veil === 1 && towards === 1) {
          tree.alpha = one.own;
          faded.delete(tree);
          continue;
        }
        tree.alpha = one.own * one.veil;
        one.written = tree.alpha;
        moving ||= one.veil !== towards;
      }
      return moving;
    },
  };
}

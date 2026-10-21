import type { RecipeName } from '../ui/container/recipes';
import type { BayName } from './bayBox';

/**
 * What each tile of the spread is dressed in: the container a pane standing there is drawn in, open, and put
 * away to its strip, which no deep frame fits. Named by where the pane belongs in the spread, so a pane is
 * dressed the same on a phone, where the two bays are not named for where they are. A tile not here is
 * undressed, and its pane still draws its own box. A pane with no tile, which stands only on a phone, the settings,
 * is dressed as the corner's panes are, below with them. See docs/LOOK-AND-FEEL.md and docs/UI-COMPONENTS.md.
 */
export interface Dress {
  readonly open: RecipeName;
  readonly strip: RecipeName;
}

const DRESSES: Partial<Record<BayName, Dress>> = {
  bottomLeft: { open: 'pane.corner', strip: 'strip.corner' },
  left: { open: 'pane.rail', strip: 'strip.corner' },
  right: { open: 'pane.right', strip: 'strip.right' },
  bottomMiddle: { open: 'pane.middle', strip: 'strip.middle' },
};

export function dressOf(home: BayName | null): Dress | undefined {
  return DRESSES[home ?? 'bottomLeft'];
}

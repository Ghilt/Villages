import { useSyncExternalStore } from 'react';

import { Icon } from './Icons';
import { baysNow, giveBack, NEAR_BAY, takeOver, watchBays, where } from './bays';
import { NAVIGATION_PANE } from './panes';

/**
 * The compass, standing in the stage's bottom right corner: the way to everything not on the screen.
 *
 * It replaced a kebab that opened a menu of panes. A menu is a thing to read and then act on; this is one
 * tap that puts **navigation** in a bay, and navigation is a pane like any other rather than a list
 * floating over the world. On a phone that matters twice over - the map stays up beside it, and a menu
 * that covers what it is about is a menu you have to dismiss to use. See decision record 0043.
 *
 * **It takes the bay under the thumb**, which is the bottom one on a tall phone and the right one on a
 * wide one, whatever the player has swapped into it. Pressing it again gives that bay back to whatever
 * navigation took it from.
 *
 * **It never resizes anything.** Landing in a bay that is a strip is fine and is why navigation's strip
 * carries the marks of where else to go: a strip of a list of ways on is still a list of ways on. That is
 * the difference between it and a window opened on a clicked castle, which does open its bay to half. See
 * decision records 0046 and 0047.
 *
 * It knows nothing about how the stage is cut, which is the clearest sign it is in the right place now:
 * it used to ride the seam, and the seam is the one thing on the stage that moves.
 *
 * Only in the bays. The spread reaches the same pane through the compass **tab** in the corner, which is
 * the same mark doing the same job in the room that form has for it.
 */

export function Compass() {
  const bays = useSyncExternalStore(watchBays, baysNow);
  const at = bays.holding.indexOf(NAVIGATION_PANE.id);
  const open = at !== -1;

  const press = () => {
    if (open) {
      giveBack(NAVIGATION_PANE.id);
      return;
    }
    takeOver(NEAR_BAY, NAVIGATION_PANE.id);
  };

  const said = open ? 'put the ways back away' : `the ways back, ${where(NEAR_BAY)}`;

  return (
    <div className="compass">
      <button
        type="button"
        className={open ? 'compass__open compass__open--up' : 'compass__open'}
        aria-pressed={open}
        aria-label={said}
        title={said}
        onClick={press}
      >
        <Icon name="compass" />
      </button>
    </div>
  );
}

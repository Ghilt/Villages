import { useSyncExternalStore } from 'react';

import { Icon } from './Icons';
import { awayFromTheMap, baysNow, giveBack, takeOver, watchBays, where } from './bays';
import { NAVIGATION_PANE } from './panes';

/**
 * The compass, on the seam between the two bays: the way to everything that is not on the screen.
 *
 * It replaced a kebab that opened a menu of panes with a pair of arrows on every row. A menu is a thing to
 * read and then act on; this is one tap that puts **navigation** in a bay, and navigation is a pane like any
 * other rather than a list floating over the world. On a phone that matters twice over - the map stays up
 * beside it, and a menu that covers what it is about is a menu you have to dismiss to use. See decision
 * record 0043.
 *
 * It takes **the bay that is not the map's**, for the reason a clicked castle does: what a player wants next
 * is somewhere to go, and putting the list over the world would hide the thing they are navigating. Pressing
 * it again gives the bay back to whatever navigation took it from.
 *
 * Only in the bays. The spread reaches the same pane through the compass **tab** in the corner, which is the
 * same mark doing the same job in the room that form has for it.
 */

interface CompassProps {
  along: 'rows' | 'columns';
}

export function Compass({ along }: CompassProps) {
  const bays = useSyncExternalStore(watchBays, baysNow);
  const at = bays.holding.indexOf(NAVIGATION_PANE.id);
  const open = at !== -1;

  const press = () => {
    if (open) {
      giveBack(NAVIGATION_PANE.id);
      return;
    }
    takeOver(awayFromTheMap(), NAVIGATION_PANE.id);
  };

  const said = open ? 'put the ways back away' : `the ways back, ${where(awayFromTheMap())}`;

  return (
    <div className={`compass compass--${along}`}>
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

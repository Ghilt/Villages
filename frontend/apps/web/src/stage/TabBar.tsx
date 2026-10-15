import type { CSSProperties } from 'react';

import { Icon } from './Icons';
import type { Pane, Room } from './panes';
import { PaneSizeControl } from './PaneSizeControl';

/**
 * The tab bar: several panes sharing one bay, and a strip of marks saying which is up.
 *
 * The spread has one tile for the corner and three things that belong in it - the house status, the key
 * figures and **navigation** - and only so much column. A tab bar is how a bay holds more than one pane
 * without the layout growing a case for it: the tile is one rectangle, the panes take turns in it, and the
 * arithmetic only learns that the tile is `TAB_BAR` taller than its own size. See decision record 0042.
 *
 * **The tile's size control is at its far end**, one for the tile rather than one in each pane, because
 * the tile is one size whichever tab is up: pressing a tab never resizes anything, and the control says
 * how big the corner is rather than how big one of its tabs is. See decision record 0057.
 *
 * **Marks and no words.** The column is 26rem at its widest and less when squeezed, and two words on a tab
 * is a tab that wraps. The mark is the one the pane declared, the name is its title, and a player who wants
 * the name hovers it or reads it aloud to a screen reader.
 *
 * Only in the spread. On a phone the same panes are reached through the compass, because a tab bar on a
 * 390-wide stage is a row of things too small to hit, and each of them carries its own control there.
 */

interface TabBarProps {
  /** The panes sharing this tile, in the order they were declared. */
  sharing: readonly Pane[];
  /** Which of them is up. */
  showing: string;
  onShow: (id: string) => void;
  /** The tile's size, which is every tab's, and the way to ask for another. */
  room: Room;
  /** Where the strip is, which is the top of the tile its panes share. */
  style: CSSProperties;
  /** Whether the tile is dressed, so that the strip of tabs on top of it is in the same colours. */
  dressed?: boolean;
  /** What the tabs are, for a screen reader: what is in this corner, or in this column. */
  label?: string;
}

export function TabBar({
  sharing,
  showing,
  onShow,
  room,
  style,
  dressed = false,
  label = 'What is in this corner',
}: TabBarProps) {
  return (
    <div className={dressed ? 'tabs tabs--dressed' : 'tabs'} style={style}>
      <div className="tabs__all" role="tablist" aria-label={label}>
        {sharing.map((pane) => {
          const up = pane.id === showing;
          return (
            <button
              key={pane.id}
              type="button"
              role="tab"
              className={up ? 'tabs__one tabs__one--up' : 'tabs__one'}
              aria-selected={up}
              aria-label={pane.title}
              title={pane.title}
              onClick={() => onShow(pane.id)}
            >
              <Icon name={pane.icon} />
            </button>
          );
        })}
      </div>
      <PaneSizeControl room={room} />
    </div>
  );
}

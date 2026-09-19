import type { CSSProperties } from 'react';

import { Icon } from './Icons';
import type { Pane } from './panes';

/**
 * The tab bar: several panes sharing one bay, and a strip of marks saying which is up.
 *
 * The spread has one tile for the corner and two things that belong in it - the house status and
 * **navigation** - and only so much column. A tab bar is how a bay holds more than one pane without the
 * layout growing a case for it: the tile is one rectangle, the panes take turns in it, and the arithmetic
 * only learns that the tile is `TAB_BAR` taller than whatever is up. See decision record 0042.
 *
 * **Marks and no words.** The column is 26rem at its widest and less when squeezed, and two words on a tab
 * is a tab that wraps. The mark is the one the pane declared, the name is its title, and a player who wants
 * the name hovers it or reads it aloud to a screen reader.
 *
 * Only in the spread. On a phone the same panes are reached through the compass, because a tab bar on a
 * 390-wide stage is a row of things too small to hit.
 */

interface TabBarProps {
  /** The panes sharing this tile, in the order they were declared. */
  sharing: readonly Pane[];
  /** Which of them is up. */
  showing: string;
  onShow: (id: string) => void;
  /** Where the strip is, which is the top of the tile its panes share. */
  style: CSSProperties;
}

export function TabBar({ sharing, showing, onShow, style }: TabBarProps) {
  return (
    <div className="tabs" role="tablist" aria-label="What is in this corner" style={style}>
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
  );
}

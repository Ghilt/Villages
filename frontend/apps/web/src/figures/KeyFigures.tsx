import { useSyncExternalStore } from 'react';

import { gatewayState, watchGateway } from '../net/gateway';
import type { Room } from '../stage/panes';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { fullName } from './describe';

/**
 * **Key figures**: the few named people the house acts through.
 *
 * A pane of its own in the corner, the tab between the house status and navigation, and a row of *Go to*
 * on a phone. Three sizes and the mechanic owns them all: the **strip** is its name, the **normal** size and
 * the **opened-out** one are the portraits. A house starts with none, and a house with none is told so in
 * the words Adam gave it, rather than being shown an empty frame. See `MECHANICS.md` and decision record
 * 0055.
 */
export function KeyFigures({ room }: { room: Room }) {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const figures = heard.yourKeyFigures ?? [];

  if (room.size === 'strip') {
    return (
      <section className="figures figures--strip" aria-label="Key figures">
        <span className="figures__kind">Key figures</span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  return (
    <section className={`figures figures--${room.size}`} aria-label="Key figures">
      <header className="figures__bar">
        <h2 className="figures__head">Key figures</h2>
        <PaneSizeControl room={room} />
      </header>

      {figures.length === 0 ? (
        <p className="figures__empty">Key figures will be shown here.</p>
      ) : (
        <ol className="figures__names">
          {figures.map((figure) => (
            <li key={figure.id}>{fullName(figure)}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

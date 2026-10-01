import { useSyncExternalStore } from 'react';

import { gatewayState, watchGateway } from '../net/gateway';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Room } from '../stage/panes';
import { howMany } from './describe';

/**
 * **Character dialogue**: the conversations the house has been offered, and the one being read.
 *
 * It stands from the house's first dialogue on and is never closed after that, because the finished ones
 * are kept to be read back. In the spread it is the column down the right edge, and on a phone a pane like
 * any other. See `MECHANICS.md` and decision record 0069.
 *
 * What it draws is the list and a conversation, which are the next two steps of the plan; until then it is
 * its name, its size control and how many are waiting and finished, which is enough to see it stand, open
 * out and be put away. See `docs/plans/character-dialogue.md`.
 */
export function Dialogues({ room }: { room: Room }) {
  const dialogues = useSyncExternalStore(watchGateway, gatewayState).yourDialogues ?? [];

  if (room.size === 'strip') {
    return (
      <section className="dialogues dialogues--strip" aria-label="Dialogues">
        <span className="dialogues__name">Dialogues</span>
        <span className="dialogues__count">{howMany(dialogues)}</span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  return (
    <section className={`dialogues dialogues--${room.size}`} aria-label="Dialogues">
      <header className="dialogues__head">
        <h2 className="dialogues__name">Dialogues</h2>
        <PaneSizeControl room={room} />
      </header>
      <p className="dialogues__count">{howMany(dialogues)}</p>
    </section>
  );
}

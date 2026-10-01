import { useMemo, useSyncExternalStore } from 'react';

import { gatewayState, watchGateway } from '../net/gateway';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Room } from '../stage/panes';
import { howMany, type ListedDialogue, listOf } from './describe';

/**
 * **Character dialogue**: the conversations the house has been offered, and the one being read.
 *
 * It stands from the house's first dialogue on and is never closed after that, because the finished ones
 * are kept to be read back. In the spread it is the column down the right edge, and on a phone a pane like
 * any other. See `MECHANICS.md` and decision records 0069 and 0070.
 *
 * Two states, the list and a conversation, and this is the list: the dialogues waiting, and under them the
 * ones finished, scrolling. The same list at both open sizes, which simply shows more of it opened out.
 * Pressing one opens nothing yet; that is the conversation, the plan's next step. Put away it is its name
 * and how many there are. See `docs/plans/character-dialogue.md`.
 */
export function Dialogues({ room }: { room: Room }) {
  const dialogues = useSyncExternalStore(watchGateway, gatewayState).yourDialogues;
  const list = useMemo(() => listOf(dialogues ?? []), [dialogues]);

  if (room.size === 'strip') {
    return (
      <section className="dialogues dialogues--strip" aria-label="Dialogues">
        <span className="dialogues__name">Dialogues</span>
        <span className="dialogues__count">{howMany(dialogues ?? [])}</span>
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

      <div className="dialogues__list">
        <h3 className="dialogues__group">Waiting</h3>
        {list.waiting.length === 0 ? (
          <p className="dialogues__none">Nothing is waiting.</p>
        ) : (
          <Rows dialogues={list.waiting} />
        )}

        {/* Finished is history, so a house with none yet is not told so. */}
        {list.finished.length > 0 && (
          <>
            <h3 className="dialogues__group">Finished</h3>
            <Rows dialogues={list.finished} />
          </>
        )}
      </div>
    </section>
  );
}

function Rows({ dialogues }: { dialogues: readonly ListedDialogue[] }) {
  return (
    <ol className="dialogues__rows">
      {dialogues.map((one) => (
        <li key={one.id} className={one.lapsed ? 'dialogues__row dialogues__row--lapsed' : 'dialogues__row'}>
          <span className="dialogues__title">{one.title}</span>
          {one.progress !== null && <span className="dialogues__progress">{one.progress}</span>}
          <span className="dialogues__line">{one.line}</span>
        </li>
      ))}
    </ol>
  );
}

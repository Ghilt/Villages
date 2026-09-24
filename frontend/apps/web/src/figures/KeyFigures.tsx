import { useState, useSyncExternalStore } from 'react';

import type { KeyFigureView } from '@villages/protocol';

import { note } from '../debug/log';
import { gatewayState, watchGateway } from '../net/gateway';
import { Icon } from '../stage/Icons';
import type { Room } from '../stage/panes';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { fullName } from './describe';
import { Portrait } from './Portrait';
import { stillOpen, viewOf } from './view';

/**
 * **Key figures**: the few named people the house acts through.
 *
 * A pane of its own in the corner, the tab between the house status and navigation, and a row of *Go to*
 * on a phone. Three sizes and the mechanic owns them all: the **strip** is a name, the pane's or the open
 * figure's, and the **normal** and **opened-out** sizes are the portraits - a grid of them, three by three
 * and never scrolling, in the order they joined, or one figure's details with the nine squares to go back
 * to all of them by. Which of those it is follows `view.ts`, which has the rules and their test.
 *
 * A house starts with none, and a house with none is told so in the words Adam gave it rather than shown
 * an empty frame. See `MECHANICS.md` and decision record 0055.
 */
export function KeyFigures({ room }: { room: Room }) {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const figures = heard.yourKeyFigures ?? [];
  const [open, setOpen] = useState<string | null>(null);

  // A lone figure is open whether or not anybody pressed them, and is kept open, so that a second
  // arriving leaves them open with a way back. Settled while rendering rather than in an effect, so the
  // grid never flashes up between the two; `stillOpen` of its own answer is the same answer.
  const kept = stillOpen(figures, open);
  if (kept !== open) {
    setOpen(kept);
  }
  const view = viewOf(figures, kept);

  const show = (figure: KeyFigureView) => {
    setOpen(figure.id);
    note('figures', `showing ${fullName(figure)}`);
  };
  const back = () => {
    setOpen(null);
    note('figures', `back to all ${figures.length} of them`);
  };

  if (room.size === 'strip') {
    return (
      <section className="figures figures--strip" aria-label="Key figures">
        <span className="figures__kind">
          {view.kind === 'details' ? fullName(view.figure) : 'Key figures'}
        </span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  return (
    <section className={`figures figures--${room.size} figures--${view.kind}`} aria-label="Key figures">
      <header className="figures__bar">
        {view.kind === 'details' && view.back && (
          <button
            type="button"
            className="figures__back"
            aria-label="all the key figures"
            title="all the key figures"
            onClick={back}
          >
            <Icon name="nine" />
          </button>
        )}
        <h2 className="figures__head">Key figures</h2>
        <PaneSizeControl room={room} />
      </header>

      {view.kind === 'empty' && <p className="figures__empty">Key figures will be shown here.</p>}

      {view.kind === 'grid' && (
        <ol className="figures__grid">
          {view.figures.map((figure) => (
            <li className="figures__cell" key={figure.id}>
              <button
                type="button"
                className="figures__thumb"
                aria-label={fullName(figure)}
                title={fullName(figure)}
                onClick={() => show(figure)}
              >
                <Portrait portrait={figure.portrait} name={fullName(figure)} />
                <span className="figures__caption" aria-hidden="true">
                  {figure.givenName}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {view.kind === 'details' && (
        <article className="figures__one">
          <Portrait portrait={view.figure.portrait} name={fullName(view.figure)} />
          <div className="figures__who">
            <h3 className="figures__name">{fullName(view.figure)}</h3>
          </div>
        </article>
      )}
    </section>
  );
}

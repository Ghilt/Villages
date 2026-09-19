import { useSyncExternalStore } from 'react';

import { Arrows } from '../stage/Arrows';
import { baysNow, put, type Which, watchBays } from '../stage/bays';
import { Icon } from '../stage/Icons';
import { gatewayState, watchGateway } from '../net/gateway';
import { type Pane, type Room, standingPanes } from '../stage/panes';
import { inspect } from './opening';
import { paneIdOf } from './subjects';
import { clearTrail, stepKey, trailNow, watchTrail } from './trail';

/**
 * **Navigation**: the ways from here, and the ways back.
 *
 * It has two forms, like everything else on the stage, and the difference is the same difference: the
 * spread shows everything at once and the bays choose. In the **spread** it is the **trail** and nothing
 * else, because every pane a player might go *to* is already on the screen - the map is the floor and the
 * house is behind the other tab - so what is not on the screen is exactly what has been closed. In the
 * **bays** the panes are listed above the trail, because on a phone they are genuinely somewhere else.
 *
 * **Every row is the same row, and every pane can go in either bay.** No pane is privileged: the map is not
 * pinned where it is, the house does not open only at the bottom, and navigation itself is on the list so
 * it can be moved off the bay it is standing in. Which bay a pane shares with another on a *desktop* is a
 * fact about the spread and has nothing to say about any of this. See decision record 0043.
 *
 * In the bays each row carries **the arrows**, so the player says which bay; the one it is already in is
 * marked rather than taken away. In the spread there are no bays to choose between and a row is a plain
 * click.
 */

export function Navigating({ room, along }: { room: Room; along: 'rows' | 'columns' | null }) {
  const trail = useSyncExternalStore(watchTrail, trailNow);
  const bays = useSyncExternalStore(watchBays, baysNow);
  const pending = useSyncExternalStore(watchGateway, gatewayState).yourChoice !== null;

  if (room.size === 'strip') {
    return (
      <section className="navigate navigate--strip">
        <span className="navigate__kind">Where you have been</span>
        {room.minimise !== null && (
          <button
            type="button"
            className="navigate__fold"
            aria-label="open it back up"
            title="open it back up"
            onClick={room.minimise}
          >
            {'▴'}
          </button>
        )}
      </section>
    );
  }

  /** Which bay a pane is standing in, or -1. What the arrows mark as the one you are already on. */
  const at = (id: string) => bays.holding.indexOf(id);

  return (
    <section className="navigate" aria-label="Where you have been">
      {along !== null && (
        <>
          <header className="navigate__bar">
            <h2 className="navigate__head">Go to</h2>
          </header>
          <ul className="navigate__list navigate__list--panes">
            {standingPanes(pending).map((pane) => (
              <Row
                key={pane.id}
                icon={pane.icon}
                name={pane.title}
                aside={null}
                along={along}
                at={at(pane.id)}
                onGo={(which) => which !== null && put(which, pane.id)}
              />
            ))}
          </ul>
        </>
      )}

      <header className="navigate__bar">
        <h2 className="navigate__head">Recent</h2>
        {trail.length > 0 && (
          <button
            type="button"
            className="navigate__clear"
            title="forget everywhere you have been"
            onClick={clearTrail}
          >
            forget
          </button>
        )}
      </header>

      {trail.length === 0 ? (
        <p className="navigate__empty">Nowhere yet. Click something on the map.</p>
      ) : (
        <ul className="navigate__list">
          {trail.map((step) => (
            <Row
              key={stepKey(step)}
              icon="window"
              name={step.name}
              aside={step.subject.kind}
              along={along}
              at={at(paneIdOf(step.subject))}
              onGo={(which) => {
                inspect(step.subject, which);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface RowProps {
  icon: Pane['icon'];
  name: string;
  /** What kind of thing it is, said at the far end where there are no arrows to say where it goes. */
  aside: string | null;
  along: 'rows' | 'columns' | null;
  /** The bay it is already in, or -1. */
  at: number;
  onGo: (which: Which | null) => void;
}

function Row({ icon, name, aside, along, at, onGo }: RowProps) {
  if (along === null) {
    return (
      <li className="navigate__step">
        <button type="button" className="navigate__go" onClick={() => onGo(null)}>
          <Icon name={icon} />
          <span className="navigate__name">{name}</span>
          {aside !== null && <span className="navigate__what">{aside}</span>}
        </button>
      </li>
    );
  }

  return (
    <li className="navigate__step navigate__step--picked">
      <span className="navigate__go navigate__go--label">
        <Icon name={icon} />
        <span className="navigate__name">{name}</span>
      </span>
      <Arrows along={along} here={at === -1 ? null : (at as Which)} what={name} onPick={onGo} />
    </li>
  );
}

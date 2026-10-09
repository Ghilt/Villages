import { Icon } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { type Room } from '../stage/panes';
import { inspect } from './opening';
import { trailStore, clearTrail, stepKey } from './trail';
import { useStore } from '../store/useStore';

/**
 * **Recent**: the ways back - the **trail**, where the player has been, newest first.
 *
 * The same in both forms. In the spread every pane a player might go *to* is already on the screen, the map the
 * floor and the house behind the other tab, so what is not on the screen is exactly what has been closed; on a
 * phone the bottom bar is the way to every pane, so this is the trail there too. It listed the panes above the
 * trail on a phone while the compass opened it, which the bar made a second list of the same things. See
 * decision record 0109.
 *
 * **A place pressed opens its window where a window stands**: on a phone on top, and Recent stays below beside
 * it, so the player can go on down the list; in the spread on the rail.
 *
 * Put away it is its name, as any pane's strip is: on a phone a press on it gives half each.
 */

interface NavigatingProps {
  room: Room;
}

export function Navigating({ room }: NavigatingProps) {
  const trail = useStore(trailStore, (state) => state.steps);

  if (room.size === 'strip') {
    return (
      <section className="navigate navigate--strip pane-card pane-strip" aria-label="Recent">
        <span className="navigate__kind">Recent</span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  return (
    <section className="navigate pane-card" aria-label="Recent">
      <header className="navigate__bar">
        <h2 className="navigate__head">Recent</h2>
        <PaneSizeControl room={room} />
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
            <li className="navigate__step" key={stepKey(step)}>
              <button type="button" className="navigate__go" onClick={() => inspect(step.subject)}>
                <Icon name="window" />
                <span className="navigate__name">{step.name}</span>
                <span className="navigate__what">{step.subject.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

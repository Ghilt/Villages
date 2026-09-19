import { useSyncExternalStore } from 'react';

import { Icon } from '../stage/Icons';
import type { Room } from '../stage/panes';
import { inspect } from './opening';
import { clearTrail, type Step, stepKey, trailNow, watchTrail } from './trail';

/**
 * **Navigation**: the ways back.
 *
 * In the spread it is the **trail** and nothing else, because everything a player might navigate *to* is
 * already on the screen - the map is the floor, the house is behind the other tab, and what is not on the
 * screen is exactly what has been closed. On a phone it will list the fixed panes above the trail as well,
 * and that is its own step. See decision record 0042 and `RESPONSIVE-DESIGN.md`.
 *
 * Clicking a step opens a window on it again, wherever a window goes in the form the stage is in. The trail
 * keeps what a thing was called at the time, so a house that has since left the cells this page holds is
 * still a name to click rather than "a house" - and the window it opens says out of view, which is the
 * honest answer and one it already knew how to give.
 */

export function Navigating({ room }: { room: Room }) {
  const trail = useSyncExternalStore(watchTrail, trailNow);

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

  return (
    <section className="navigate" aria-label="Where you have been">
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
            <Step key={stepKey(step)} step={step} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Step({ step }: { step: Step }) {
  return (
    <li className="navigate__step">
      <button
        type="button"
        className="navigate__go"
        onClick={() => {
          inspect(step.subject);
        }}
      >
        <Icon name="window" />
        <span className="navigate__name">{step.name}</span>
        <span className="navigate__what">{step.subject.kind}</span>
      </button>
    </li>
  );
}

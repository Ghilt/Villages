import { baysStore } from '../stage/bays';
import { Icon } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { NAVIGATION_PANE, type Pane, type Room } from '../stage/panes';
import { goTo } from '../stage/phone';
import { inspect } from './opening';
import { trailStore, clearTrail, stepKey } from './trail';
import { useStore } from '../store/useStore';

/**
 * **Navigation**: the ways from here, and the ways back.
 *
 * It has two forms, like everything else on the stage, and the difference is the same difference: the
 * spread shows everything at once and the bays choose. In the **spread** it is the **trail** and nothing
 * else, because every pane a player might go *to* is already on the screen - the map is the floor and the
 * house is behind the other tab - so what is not on the screen is exactly what has been closed. In the
 * **bays** the panes are listed above the trail, because on a phone they are genuinely somewhere else.
 *
 * **A row is a place to go, and it goes where that thing stands.** On a phone the map and a window stand on
 * top and everything else below, Adam's word of 2026-10-08, so a pane pressed takes navigation's own place
 * below, the map takes the top, and a place pressed in the trail opens its window on top while navigation
 * stays where it is, beside it. There is no needle: there is nowhere else for anything to go. In the spread
 * a row is a plain click, as it always was. See decision record 0109.
 *
 * **Put away it is still a way somewhere**, which is the third form and the reason the compass can land in
 * a strip without resizing anything. See the strip below, and decision record 0047.
 */

interface NavigatingProps {
  room: Room;
  along: 'rows' | 'columns' | null;
  /** The panes standing, the map first, which are the places there are to go to. Handed in; see `panes.tsx`. */
  going: readonly Pane[];
}

export function Navigating({ room, along, going }: NavigatingProps) {
  const trail = useStore(trailStore, (state) => state.steps);
  const bays = useStore(baysStore);

  /*
   * Put away, and still a way somewhere.
   *
   * **A strip can do something, and this is the pane where that matters.** The compass puts navigation in
   * the bay under the thumb without resizing anything, so it lands in a strip whenever the player left one
   * there - and a strip that could only offer the way back out of itself would make the compass a button
   * that does nothing useful half the time. So it carries the standing panes as marks: the map, your
   * house, the letter while a question stands, and dialogue once there is any. Pressing one goes to it,
   * where it stands, and opens it to be read.
   *
   * Marks and no words, the tab bar's argument: there is no room for a name in 44 pixels, and these are
   * the same marks the same panes carry everywhere else. See decision records 0046, 0047 and 0109.
   *
   * In the spread there are no bays for them to send anything to, so it is the name and nothing else,
   * like every other strip in the corner; the tab bar above it is already the way to the other panes.
   */
  if (room.size === 'strip' && along === null) {
    return (
      <section className="navigate navigate--strip pane-card pane-strip" aria-label="Go to">
        <span className="navigate__kind">Go to</span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  if (room.size === 'strip') {
    return (
      <section className="navigate navigate--strip pane-card pane-strip" aria-label="Go to">
        <span className="navigate__kind">Go to</span>
        <span className="navigate__ways">
          {going
            .filter((pane) => pane.id !== NAVIGATION_PANE.id)
            .map((pane) => {
              const already = bays.holding.includes(pane.id);
              return (
                <button
                  key={pane.id}
                  type="button"
                  className={already ? 'navigate__there navigate__there--here' : 'navigate__there'}
                  aria-pressed={already}
                  aria-label={already ? `${pane.title}, already up` : `go to ${pane.title}`}
                  title={already ? 'already up' : `go to ${pane.title}`}
                  onClick={() => goTo(pane.id)}
                >
                  <Icon name={pane.icon} />
                </button>
              );
            })}
        </span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  return (
    <section className="navigate pane-card" aria-label="Go to">
      {along !== null && (
        <>
          <header className="navigate__bar">
            <h2 className="navigate__head">Go to</h2>
            <PaneSizeControl room={room} />
          </header>
          <ul className="navigate__list navigate__list--panes">
            {going.map((pane) => (
              <Row key={pane.id} icon={pane.icon} name={pane.title} aside={null} onGo={() => goTo(pane.id)} />
            ))}
          </ul>
        </>
      )}

      <header className="navigate__bar">
        <h2 className="navigate__head">Recent</h2>
        {along === null && <PaneSizeControl room={room} />}
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
              onGo={() => inspect(step.subject)}
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
  /** What kind of thing it is, said at the far end. */
  aside: string | null;
  onGo: () => void;
}

function Row({ icon, name, aside, onGo }: RowProps) {
  return (
    <li className="navigate__step">
      <button type="button" className="navigate__go" onClick={onGo}>
        <Icon name={icon} />
        <span className="navigate__name">{name}</span>
        {aside !== null && <span className="navigate__what">{aside}</span>}
      </button>
    </li>
  );
}

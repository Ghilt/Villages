import { baysStore, put, where } from '../stage/bays';
import { type Which } from '../stage/arrangement';
import { Icon, Needle, pointAt } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { NAVIGATION_PANE, type Pane, type Room } from '../stage/panes';
import { inspect } from './opening';
import { paneIdOf } from './subjects';
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
 * **Every row is the same row, and every pane can go in either bay.** No pane is privileged: the map is not
 * pinned where it is, the house does not open only at the bottom, and navigation itself is on the list so
 * it can be moved off the bay it is standing in. Which bay a pane shares with another on a *desktop* is a
 * fact about the spread and has nothing to say about any of this. See decision record 0043.
 *
 * **A row is a place to go, and there is one of each.** Pressing the row itself puts the thing **here**, in
 * the bay navigation is standing in, which is what a player means nine times in ten: they came to this list
 * to leave it. The single **needle** at the far end sends it to the *other* bay instead, and it points
 * there so it reads as somewhere rather than as a second way to do the same thing.
 *
 * That replaced a pair of arrows on every row. Two marks where one would do made a list of four rows into a
 * list of eight decisions, and neither of them was the obvious one - which was pressing the row. In the
 * spread there is one bay a thing goes into, so there is no needle at all and the row is a plain click.
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
   * house, the letter while a question stands, and dialogue once there is any. Pressing one sends that
   * pane to the **other** bay, which is the only bay a 44-pixel list can usefully change - the player is
   * looking at what is beside this, not at this.
   *
   * Marks and no words, the tab bar's argument: there is no room for a name in 44 pixels, and these are
   * the same marks the same panes carry everywhere else. See decision records 0046 and 0047.
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
    const mine = bays.holding.indexOf(NAVIGATION_PANE.id);
    const beside: Which = mine === 0 ? 1 : 0;

    return (
      <section className="navigate navigate--strip pane-card pane-strip" aria-label="Go to">
        <span className="navigate__kind">Go to</span>
        <span className="navigate__ways">
          {going
            .filter((pane) => pane.id !== NAVIGATION_PANE.id)
            .map((pane) => {
              const already = bays.holding[beside] === pane.id;
              return (
                <button
                  key={pane.id}
                  type="button"
                  className={already ? 'navigate__there navigate__there--here' : 'navigate__there'}
                  aria-pressed={already}
                  aria-label={
                    already
                      ? `${pane.title} is already ${where(beside)}`
                      : `put ${pane.title} ${where(beside)}`
                  }
                  title={already ? `already ${where(beside)}` : `put it ${where(beside)}`}
                  onClick={() => put(beside, pane.id)}
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

  /** Which bay a pane is standing in, or -1. What the needle marks as the one it is already on. */
  const at = (id: string) => bays.holding.indexOf(id);

  // Where a row lands when the row itself is pressed, and where the needle sends it instead.
  const here = bays.holding.indexOf(NAVIGATION_PANE.id) as Which | -1;
  const mine: Which = here === -1 ? 1 : here;
  const there: Which = mine === 0 ? 1 : 0;

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
              <Row
                key={pane.id}
                icon={pane.icon}
                name={pane.title}
                aside={null}
                along={along}
                at={at(pane.id)}
                here={mine}
                there={there}
                onGo={(which) => which !== null && put(which, pane.id)}
              />
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
              along={along}
              at={at(paneIdOf(step.subject))}
              here={mine}
              there={there}
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
  /** The bay navigation is standing in, which is where pressing the row puts a thing. */
  here: Which;
  /** The other one, which is where the needle sends it. */
  there: Which;
  onGo: (which: Which | null) => void;
}

function Row({ icon, name, aside, along, at, here, there, onGo }: RowProps) {
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

  const already = at === there;

  return (
    <li className="navigate__step navigate__step--picked">
      <button
        type="button"
        className="navigate__go"
        aria-label={`${name}, ${where(here)}`}
        onClick={() => onGo(here)}
      >
        <Icon name={icon} />
        <span className="navigate__name">{name}</span>
      </button>
      <button
        type="button"
        className={already ? 'navigate__there navigate__there--here' : 'navigate__there'}
        aria-label={already ? `${name} is already ${where(there)}` : `put ${name} ${where(there)}`}
        aria-pressed={already}
        title={already ? `already ${where(there)}` : `put it ${where(there)}`}
        onClick={() => onGo(there)}
      >
        <Needle point={pointAt(along, there)} />
      </button>
    </li>
  );
}

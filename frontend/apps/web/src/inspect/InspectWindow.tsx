import { Fragment, useEffect } from 'react';

import { useSyncExternalStore } from 'react';

import { focusOn } from '../map/focus';
import { Icon } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { baysNow, put, watchBays, type Which } from '../stage/bays';
import { MAP_PANE, type Room } from '../stage/panes';
import type { Description, Link } from './describe';
import { inspect, stopInspecting } from './opening';
import { paneIdOf, type Subject } from './subjects';
import { remember } from './trail';

/**
 * **Inspect window**: what one thing in the world is, and the ways on from it.
 *
 * It renders a **description** and knows nothing about what kind of thing made it, the way the parchment
 * renders any choice from its words. A new kind of subject costs a function in `describe.ts` and not a line
 * here. See `MECHANICS.md`.
 *
 * The links are the point of it. A window is travelled from rather than read and closed: following one from
 * a house to the ground it stands in, and from there to whoever else stands in it, is how a player reads a
 * neighbourhood without having to think of the next question.
 *
 * **A link is one button, and it opens in the other bay.** It used to be its words with the **arrows**
 * beside them, so the player said not only *what* but *where*; that made a list of four links a list of
 * eight decisions and neither of them was the obvious one, which was following the link. There is one
 * sensible place for a thing to open - the bay this window is not in, so the window it came from stays on
 * the screen - and the player who wants it elsewhere has **navigation** for that. The same argument 0043
 * made for navigation's rows, arrived at from the other end. See decision record 0049.
 *
 * **Show it on the map is its mark rather than its words**, in both forms: it is the only link that does
 * not open a window, and the map is the one thing on the stage a player already knows the mark for.
 */

interface InspectWindowProps {
  subject: Subject;
  said: Description;
  /**
   * The arrows, when there are two bays to choose between. In the spread there is one place a window goes
   * and one map, so a link is a plain click and no arrows are drawn.
   */
  along: 'rows' | 'columns' | null;
  /** The room it got, which is what its size control reports and changes. */
  room: Room;
}

export function InspectWindow({ subject, said, along, room }: InspectWindowProps) {
  const bays = useSyncExternalStore(watchBays, baysNow);

  /*
   * The bay this window is not in, which is where everything it offers opens.
   *
   * A window nobody can see is not an answer to a click, and following a link from a window that then
   * covers itself is the same mistake the compass was making. A window in no bay - which is every window
   * in the spread - has nowhere to send anything, and `follow` is handed null there anyway.
   */
  const mine = bays.holding.indexOf(paneIdOf(subject));
  const there: Which = mine === 0 ? 1 : 0;
  // The trail learns a thing's name here because here is the only place that knows one: a name is the
  // description's, and the trail outlives the window - and a house that has left view has no name to look
  // up later. See `trail.ts`.
  useEffect(() => {
    remember(subject, said.name);
  }, [subject, said.name]);

  const follow = (link: Link, into: Which | null) => {
    if (link.to === 'map') {
      focusOn(link.at);
      if (into !== null) {
        put(into, MAP_PANE.id);
      }
      return;
    }
    inspect(link.subject, into);
  };

  const opens = along === null ? null : there;

  return (
    <section className="inspect" aria-live="polite">
      <header className="inspect__bar">
        <span className="inspect__kind">{said.kind}</span>
        <PaneSizeControl room={room} />
        <button
          type="button"
          className="inspect__close"
          aria-label={`close ${said.name}`}
          title={`close ${said.name}`}
          onClick={() => stopInspecting(subject)}
        >
          <Icon name="close" />
        </button>
      </header>

      <h2 className="inspect__name">{said.name}</h2>
      {said.under !== undefined && <p className="inspect__blazon">{said.under}</p>}

      {/* Bare `dt`/`dd`, not wrapped in a row each: the list is a two-column grid and a wrapper would
          become the grid item instead of the pair. */}
      <dl className="inspect__facts">
        {said.facts.map((fact) => (
          <Fragment key={fact.what}>
            <dt>{fact.what}</dt>
            <dd className={fact.ticking === true ? 'inspect__ticking' : undefined}>{fact.said}</dd>
          </Fragment>
        ))}
      </dl>

      {said.links.length > 0 && (
        <>
          <h3 className="inspect__onward">Links</h3>
          <ul className="inspect__links">
            {said.links.map((link) => (
              <li className="inspect__link" key={`${link.to}:${link.what}`}>
                <button
                  type="button"
                  className={link.to === 'map' ? 'inspect__go inspect__go--map' : 'inspect__go'}
                  aria-label={link.what}
                  title={link.what}
                  onClick={() => follow(link, opens)}
                >
                  {link.to === 'map' ? <Icon name="map" /> : link.what}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

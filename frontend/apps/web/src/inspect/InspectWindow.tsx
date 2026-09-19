import { Fragment } from 'react';

import { focusOn } from '../map/focus';
import { Arrows } from '../stage/Arrows';
import { put, type Which } from '../stage/bays';
import { MAP_PANE } from '../stage/panes';
import type { Description, Link } from './describe';
import { inspect, stopInspecting } from './opening';
import type { Subject } from './subjects';

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
 */

interface InspectWindowProps {
  subject: Subject;
  said: Description;
  /**
   * The arrows, when there are two bays to choose between. In the spread there is one place a window goes
   * and one map, so a link is a plain click and no arrows are drawn.
   */
  along: 'rows' | 'columns' | null;
}

export function InspectWindow({ subject, said, along }: InspectWindowProps) {
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

  return (
    <section className="inspect" aria-live="polite">
      <header className="inspect__bar">
        <span className="inspect__kind">{said.kind}</span>
        <button
          type="button"
          className="inspect__close"
          aria-label={`close ${said.name}`}
          onClick={() => stopInspecting(subject)}
        >
          close
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
                {along === null ? (
                  <button type="button" className="inspect__go" onClick={() => follow(link, null)}>
                    {link.what}
                  </button>
                ) : (
                  <>
                    <span className="inspect__what">{link.what}</span>
                    <Arrows along={along} what={link.what} onPick={(which) => follow(link, which)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

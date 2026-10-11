import { Fragment, useEffect } from 'react';

import { Portrait } from '../figures/Portrait';
import { focusOn } from '../map/focus';
import { Icon } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { type Room } from '../stage/panes';
import { Tag } from '../ui/tag/Tag';
import { SUBJECT_MARKS } from './pane';
import type { Description, Link, SlotSeen } from './describe';
import { SlotRow } from '../ui/socket/Socket';
import { inspectBeside, stopInspecting } from './opening';
import { type Subject } from './subjects';
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

interface WindowBarProps {
  subject: Subject;
  /** What kind of thing it is, in words: what the mark says to anyone hovering it or reading the page. */
  kind: string;
  /** Which one: the name, where one is known. */
  name: string;
  room: Room;
  /** How the stage is cut, or null in the spread: the one form a window can be closed in. */
  along: 'rows' | 'columns' | null;
  /**
   * How fresh what it shows is, for a thing on the map: `current`, or the day the fog hid it, and the words a
   * pointer resting on it is told. Absent where it cannot be said. See decision record 0089.
   */
  fresh?: { said: string; meant: string } | null;
}

/**
 * A window's first row: its mark, its name, its size control and, on a desktop, its close.
 *
 * **Put away, this row is the whole window**, which is why it is its own piece: a strip says which house
 * rather than that it is a house, and on a desktop can be shut without being opened first. The kind is
 * the mark and no longer a word above the name, the mark each kind is known by everywhere else.
 *
 * **On a phone there is no close.** A window there is one of two bays, and it is replaced by navigating
 * to something else, which is how every pane on a phone leaves its bay. See `MECHANICS.md`.
 */
export function WindowBar({ subject, kind, name, room, along, fresh }: WindowBarProps) {
  return (
    <>
      <span className="inspect__mark" role="img" aria-label={kind} title={kind}>
        <Icon name={SUBJECT_MARKS[subject.kind]} />
      </span>
      <span className="inspect__named">
        <h2 className="inspect__name" title={name}>
          {name}
        </h2>
        {fresh != null && <Tag title={fresh.meant}>{fresh.said}</Tag>}
      </span>
      <PaneSizeControl room={room} />
      {along === null && (
        <button
          type="button"
          className="inspect__close"
          aria-label={`close ${name}`}
          title={`close ${name}`}
          onClick={() => stopInspecting(subject)}
        >
          <Icon name="close" />
        </button>
      )}
    </>
  );
}

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
  /** How fresh what it shows is, beside its name. See `WindowBar` and decision record 0089. */
  fresh?: { said: string; meant: string } | null;
}

export function InspectWindow({ subject, said, along, room, fresh }: InspectWindowProps) {
  // The trail learns a thing's name here because here is the only place that knows one: a name is the
  // description's, and the trail outlives the window - and a house that has left view has no name to look
  // up later. See `trail.ts`.
  useEffect(() => {
    remember(subject, said.name);
  }, [subject, said.name]);

  /*
   * Everything a window offers opens beside it, in the bay it is not in: a window nobody can see is not an
   * answer to a click, and following a link from a window that then covers itself is the same mistake the
   * compass was making. The room knows which bay that is; in the spread there is none to choose.
   */
  const follow = (link: Link) => {
    if (link.to === 'map') {
      focusOn(link.at);
      room.showMap();
      return;
    }
    inspectBeside(link.subject, room);
  };

  return (
    <section className="inspect" aria-live="polite">
      <header className="inspect__bar">
        <WindowBar
          subject={subject}
          kind={said.kind}
          name={said.name}
          room={room}
          along={along}
          fresh={fresh ?? null}
        />
      </header>

      {said.likeness !== undefined && (
        <div className="inspect__likeness">
          <Portrait portrait={said.likeness.portrait} name={said.name} />
        </div>
      )}
      {said.under !== undefined && <p className="inspect__blazon">{said.under}</p>}
      {said.about !== undefined && <p className="inspect__about">{said.about}</p>}

      {/* Bare `dt`/`dd`, not wrapped in a row each: the list is a two-column grid and a wrapper would
          become the grid item instead of the pair. None where there is nothing to list, as for water. */}
      {said.facts.length > 0 && (
        <dl className="inspect__facts">
          {said.facts.map((fact) => (
            <Fragment key={fact.what}>
              <dt>{fact.what}</dt>
              <dd className={fact.ticking === true ? 'inspect__ticking' : undefined}>{fact.said}</dd>
            </Fragment>
          ))}
        </dl>
      )}

      {said.slots !== undefined && said.slots.length > 0 && <Slots slots={said.slots} />}
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
                  onClick={() => follow(link)}
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

/** A structure's slots, a row of sockets each, as the window and the Holdings tab draw them. */
export function Slots({ slots }: { slots: readonly SlotSeen[] }) {
  return (
    <div className="inspect__slots">
      {slots.map((slot) => (
        <SlotRow
          key={slot.name}
          name={slot.name}
          places={slot.places}
          contents={slot.contents ?? []}
          secret={slot.contents === null}
          size={40}
        />
      ))}
    </div>
  );
}

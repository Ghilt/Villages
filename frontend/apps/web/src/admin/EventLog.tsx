import './event-log.css';

import { useEffect, useState } from 'react';

import { connect } from '@villages/client-core';
import { PROTOCOL_VERSION } from '@villages/protocol';
import type { EventFrame } from '@villages/protocol';

import { browserSocket } from '../net/browserSocket';
import { GATEWAY_URL } from '../net/address';
import { mapLink } from '../net/startAt';
import { placeIn } from './eventLinks';
import { BackToIndex } from './InspectIndex';

/** Enough to hold a session's worth of play. Past this the oldest go, as in any log. */
const MOST = 2000;

/**
 * Every event the world stores, as it is stored, for reading.
 *
 * Its own page rather than a panel on the map, because it is not part of the game: it is how the world's
 * history is inspected. It watches without playing - no hello, so the gateway knows of no player here and
 * opening it neither founds anything nor takes a window over. See decision records 0023 and 0028.
 *
 * It opens on the end of the chronicle - the hundred most recent events the world stored - and then goes
 * on showing what happens next. That window is a read model and not the store: the whole chronicle,
 * paged, is a different thing and is not this.
 */
export function EventLog() {
  const [events, setEvents] = useState<readonly EventFrame[]>([]);
  const [state, setState] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    // A connection that has been torn down says nothing about the one that replaced it. React mounts an
    // effect twice in development, so without this the first socket's close reports the second as shut.
    let live = true;

    const socket = browserSocket(GATEWAY_URL);
    socket.onOpen(() => live && setState('open'));
    socket.onClose(() => live && setState('closed'));

    // No player token: a viewer is not a player, and one that said hello would take a window over.
    const connection = connect({ socket, protocolVersion: PROTOCOL_VERSION, watchEvents: true });
    connection.onProblem((what) => live && setProblem(what));
    connection.onFrame((frame) => {
      if (live && frame.type === 'event') {
        // An event can arrive twice: the gateway starts watching before it hands over what was missed,
        // so that nothing appended in between is lost. Identity is what makes that harmless. See 0029.
        setEvents((held) =>
          held.some((seen) => seen.id === frame.id) ? held : [frame, ...held].slice(0, MOST),
        );
      }
    });

    return () => {
      live = false;
      connection.close();
    };
  }, []);

  return (
    <main className="log">
      <header className="log__bar">
        <h1 className="log__title">Events</h1>
        <span className={`log__link log__link--${state}`}>{state}</span>
        <span className="log__count">
          {events.length} {events.length === 1 ? 'event' : 'events'}, newest first
        </span>
        <button type="button" className="log__button" onClick={() => setEvents([])}>
          clear
        </button>
        <BackToIndex />
      </header>

      {problem !== null && <p className="log__problem">{problem}</p>}

      <ol className="log__list">
        {events.length === 0 && (
          <li className="log__quiet">
            {state === 'open'
              ? 'Nothing has happened in this world yet. Play it in another window and it appears here.'
              : `Not connected to ${GATEWAY_URL}. Is the game server running?`}
          </li>
        )}
        {events.map((event) => (
          <Entry key={event.id} event={event} />
        ))}
      </ol>
    </main>
  );
}

/** `villages.player.givenChoice.v1` reads as `given choice`: the verb, in words, and nothing else. */
function saidPlainly(eventType: string): string {
  const verb = eventType.split('.')[2] ?? eventType;
  return verb.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

/**
 * Whose event this is: the world's, or the player's.
 *
 * The two halves of decision record 0034. The type says which, in its second segment, which is the whole
 * of what the wire carries about it and the whole of what a reader needs.
 */
function whose(eventType: string): 'world' | 'player' {
  return eventType.split('.')[1] === 'player' ? 'player' : 'world';
}

function clockOf(at: number): string {
  const when = new Date(at);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(when.getHours())}:${two(when.getMinutes())}:${two(when.getSeconds())}`;
}

function Entry({ event }: { event: EventFrame }) {
  return (
    <li className="log__entry">
      <details>
        <summary className="log__line">
          <span className="log__when">{clockOf(event.time)}</span>
          <span className={`log__whose log__whose--${whose(event.eventType)}`}>{whose(event.eventType)}</span>
          <span className="log__what">{saidPlainly(event.eventType)}</span>
          {/* The story it belongs to. Everything one command wrote wears the same tag. See 0035. */}
          <span className="log__story" title={`story ${event.correlationId}`}>
            {event.correlationId.slice(0, 8)}
          </span>
          <span className="log__stream">
            {event.stream} <span className="log__version">v{event.streamVersion}</span>
          </span>
        </summary>
        <pre className="log__json">{asStored(event)}</pre>
        <Links data={event.data} />
      </details>
    </li>
  );
}

/**
 * Where an opened event leads, under what it says: for now the map, for an event that names a place, which opens
 * the game in this tab over it. In words, not marks, by Adam's choice of 2026-10-11. A row, so that more can join it.
 */
function Links({ data }: { data: EventFrame['data'] }) {
  const place = placeIn(data);
  if (place === null) {
    return null;
  }
  return (
    <nav className="log__links" aria-label="where this event leads">
      <a className="log__go" href={mapLink(place)}>
        on the map
      </a>
    </nav>
  );
}

/**
 * The event as it is stored, laid out to be read.
 *
 * The frame's own `type` is how it crossed the wire rather than part of the event, so it is left out;
 * everything else is exactly what the store holds. See decision records 0024 and 0035.
 */
function asStored(event: EventFrame): string {
  const { id, eventType, stream, streamVersion, time, correlationId, causationId, data } = event;
  return JSON.stringify(
    { id, eventType, stream, streamVersion, time, correlationId, causationId, data },
    null,
    2,
  );
}

import { useEffect, useState } from 'react';

import { connect } from '@villages/client-core';
import { PROTOCOL_VERSION } from '@villages/protocol';
import type { EventFrame } from '@villages/protocol';

import { browserSocket } from '../net/browserSocket';
import { GATEWAY_URL } from '../net/gateway';

/** Enough to hold a session's worth of play. Past this the oldest go, as in any log. */
const MOST = 2000;

/**
 * Every event the world stores, as it is stored, for reading.
 *
 * Its own page rather than a panel on the map, because it is not part of the game: it is how the world's
 * history is inspected. It watches without playing - no hello, so the gateway knows of no player here and
 * opening it neither founds anything nor takes a window over. See decision records 0023 and 0028.
 *
 * Only what has happened since it was opened. The gateway's feed starts from now for a watcher, which is
 * deliberate: this shows the world happening rather than replaying the whole chronicle on every visit.
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
        setEvents((held) => [frame, ...held].slice(0, MOST));
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
          {events.length} {events.length === 1 ? 'event' : 'events'} since this page was opened
        </span>
        <button type="button" className="log__button" onClick={() => setEvents([])}>
          clear
        </button>
      </header>

      {problem !== null && <p className="log__problem">{problem}</p>}

      <ol className="log__list">
        {events.length === 0 && (
          <li className="log__quiet">
            {state === 'open'
              ? 'Nothing yet. Play the world in another window and it appears here.'
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

/** `villages.house.givenChoice.v1` reads as `house given choice`, which is what a line should say. */
function saidPlainly(eventType: string): string {
  const [, aggregate, verb] = eventType.split('.');
  const words = (verb ?? eventType).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return `${aggregate ?? '?'} ${words}`;
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
      </details>
    </li>
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

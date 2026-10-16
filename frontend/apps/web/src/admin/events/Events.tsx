import './events.css';

import { Fragment, useMemo, useState } from 'react';

import { INSPECT_INDEX } from '../address';
import { InspectPage } from '../frame/InspectPage';
import { useJson } from '../frame/useJson';
import { EVERY_EVENT_CARRIES, eventSays, parseEventCatalogue } from './eventCatalogue';
import type { EventSection, EventType } from './eventCatalogue';

/** What the dev server's `/event-catalogue/` sends, as `vite/eventsApi.ts` reads it. */
interface CatalogueFiles {
  readonly document: string;
  readonly samples: Readonly<Record<string, readonly { name: string; event: unknown }[]>>;
}

/** What the dev server says when `docs/EVENTS.md` or a sample changed on disk: `EVENTS_CHANGED` in `vite/eventsApi.ts`. */
const EVENTS_CHANGED = 'villages:events-changed';

/** Where the events the world stored are read, one by one as they happen. */
const EVENTS_LOG = `${INSPECT_INDEX}/inspect-events-log`;

/**
 * Every type of event the world can record, as `docs/EVENTS.md` lists them, for reading: grouped as the document
 * groups them, a stream to a group, each type by its name alone, and opened, what it carries, what it means, what
 * writes it and what reads it, and its sample from `contracts/fixtures/events/` folded under that. Read through the dev server, and again whenever
 * the document or a sample changes. Nothing here is changed: a type of event is code and a contract, changed by a
 * commit that changes both. The events the world stored are the events log's.
 */
export function Events() {
  const files = useJson<CatalogueFiles>('/event-catalogue/', EVENTS_CHANGED);
  const read = files === null || files === 'missing' ? null : files;
  const parsed = useMemo((): EventSection[] | string => {
    if (read === null) return [];
    try {
      return parseEventCatalogue(read.document);
    } catch (unread) {
      return unread instanceof Error ? unread.message : String(unread);
    }
  }, [read]);
  const sections = typeof parsed === 'string' ? [] : parsed;
  const [words, setWords] = useState('');
  const count = sections.reduce((all, section) => all + section.events.length, 0);

  return (
    <InspectPage
      title="Events"
      bar={
        <span className="inspect-note">
          {count} types from docs/EVENTS.md, a sample each from contracts/fixtures/events/
        </span>
      }
    >
      {files === 'missing' && (
        <p className="inspect-problem">
          docs/EVENTS.md could not be had: this page reads it through the dev server
        </p>
      )}
      {typeof parsed === 'string' && <p className="inspect-problem">{parsed}</p>}
      <div className="events-head">
        <input
          type="search"
          className="events-find"
          aria-label="Find a type of event"
          placeholder="a type, a field or a word"
          value={words}
          onChange={(event) => setWords(event.target.value)}
        />
      </div>
      <p className="inspect-said">
        <Prose
          text={`Every event also carries ${EVERY_EVENT_CARRIES.map((field) => `\`${field}\``).join(' and ')}, and on its envelope where it came from.`}
        />{' '}
        The events the world has stored are in <a href={EVENTS_LOG}>the events log</a>.
      </p>
      <div className="events-groups">
        {sections.map((section) => (
          <StreamSection key={section.title} section={section} words={words} samples={read?.samples ?? {}} />
        ))}
      </div>
    </InspectPage>
  );
}

/** The first sentence of what is said of a stream, which is where its events are kept. */
function firstSentence(said: readonly string[]): string {
  const first = said[0] ?? '';
  const end = first.indexOf('. ');
  return end === -1 ? first : first.slice(0, end + 1);
}

/** A stream's types of event, each by its name alone, folded until it is opened. */
function StreamSection({
  section,
  words,
  samples,
}: {
  section: EventSection;
  words: string;
  samples: CatalogueFiles['samples'];
}) {
  const shown = section.events.filter((event) => eventSays(event, words));
  if (shown.length === 0) return null;
  return (
    <section className="events-group" aria-label={section.title}>
      <h2 className="inspect-group__title">
        {section.title}{' '}
        <span className="inspect-key">
          {shown.length === section.events.length
            ? section.events.length
            : `${shown.length} of ${section.events.length}`}
        </span>
      </h2>
      <p className="events-stream">
        <Prose text={firstSentence(section.said)} />
      </p>
      <ol className="events-list">
        {shown.map((event) => (
          <li key={event.type}>
            <EventEntry event={event} samples={samples[event.type] ?? []} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** One type of event: its name, and opened, what it carries, what it means, what writes and reads it, its samples. */
function EventEntry({
  event,
  samples,
}: {
  event: EventType;
  samples: readonly { name: string; event: unknown }[];
}) {
  const carries = event.payload.filter((field) => !EVERY_EVENT_CARRIES.includes(field));
  return (
    <details className="events-entry" id={event.type}>
      <summary>
        <span className="events-name">
          {event.whose}.<strong>{event.verb}</strong>
        </span>{' '}
        <span className="inspect-key">v{event.version}</span>
      </summary>
      <div className="events-body">
        <span className="inspect-key">{event.type}</span>
        <ul className="events-fields" aria-label="What it carries">
          {carries.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>
        <p className="events-meaning">
          <Prose text={event.meaning} />
        </p>
        <dl className="events-roles">
          <dt>written by</dt>
          <dd>
            <Prose text={event.producedBy} />
          </dd>
          <dt>read by</dt>
          <dd>
            <Prose text={event.consumers} />
          </dd>
        </dl>
        {samples.length === 0 && <p className="inspect-problem">no sample in contracts/fixtures/events/</p>}
        {samples.map((sample) => (
          <details key={sample.name} className="events-sample">
            <summary>{sample.name === 'sample' ? 'a sample' : `a sample: ${sample.name}`}</summary>
            <pre>{JSON.stringify(sample.event, null, 2)}</pre>
          </details>
        ))}
      </div>
    </details>
  );
}

/** A cell of the document as it is written: a name in backticks set as code, words in double stars set strong. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(`[^`]+`|\*\*[^*]+\*\*)/)
        .map((part, at) =>
          part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
            <code key={at}>{part.slice(1, -1)}</code>
          ) : part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
            <strong key={at}>{part.slice(2, -2)}</strong>
          ) : (
            <Fragment key={at}>{part}</Fragment>
          ),
        )}
    </>
  );
}

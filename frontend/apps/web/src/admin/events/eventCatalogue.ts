/*
 * The event catalogue as the events' inspect page reads it: `docs/EVENTS.md`, a heading a stream and a table a heading,
 * each row a type of event. The same rows the domain's catalogue test holds the code to, read the same way - every row
 * of every table whose first cell is a type in backticks, five cells to a row - so the page says what the code is held
 * to and nothing else. See `EventCatalogueSpec.kt`.
 */

/** One type of event, as its row says it. */
export interface EventType {
  /** The whole CloudEvent type, `villages.house.founded.v1`. */
  readonly type: string;
  /** Whose event it is, `house`; the verb, `founded`; and its version. */
  readonly whose: string;
  readonly verb: string;
  readonly version: number;
  /** The names of what it carries, in the row's order. */
  readonly payload: readonly string[];
  /** The row's last three cells as they are written, backticks and all. */
  readonly meaning: string;
  readonly producedBy: string;
  readonly consumers: string;
}

/** A heading of the document with the types of event in its table, and what is said between the two. */
export interface EventSection {
  readonly title: string;
  /** The paragraphs between the heading and its table, each joined into one line. */
  readonly said: readonly string[];
  readonly events: readonly EventType[];
}

/** What every event carries besides its own payload, said once on the page rather than on every type. */
export const EVERY_EVENT_CARRIES: readonly string[] = ['worldTime', 'recordedAt'];

const ROW = /^\|\s*`(villages\.([a-z]+)\.([a-zA-Z]+)\.v(\d+))`\s*\|/;
const NAMED = /`([^`]+)`/g;

/** The sections of the document that list types of event, in its order. */
export function parseEventCatalogue(document: string): EventSection[] {
  const sections: { title: string; said: string[]; events: EventType[] }[] = [];
  let paragraph: string[] = [];
  const said = () => {
    const section = sections.at(-1);
    if (section !== undefined && section.events.length === 0 && paragraph.length > 0) {
      section.said.push(paragraph.join(' '));
    }
    paragraph = [];
  };
  for (const line of document.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      said();
      sections.push({ title: line.slice(3).trim(), said: [], events: [] });
      continue;
    }
    const section = sections.at(-1);
    if (section === undefined) continue;
    const row = ROW.exec(line);
    if (row !== null) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length !== 5) {
        throw new Error(`${row[1]} has ${cells.length} cells in docs/EVENTS.md, not five`);
      }
      section.events.push({
        type: row[1]!,
        whose: row[2]!,
        verb: row[3]!,
        version: Number(row[4]),
        payload: [...cells[1]!.matchAll(NAMED)].map((named) => named[1]!),
        meaning: cells[2]!,
        producedBy: cells[3]!,
        consumers: cells[4]!,
      });
    } else if (line.startsWith('|') || line.trim() === '') {
      said();
    } else {
      paragraph.push(line.trim());
    }
  }
  said();
  return sections.filter((section) => section.events.length > 0);
}

/** Whether a type of event has [words] anywhere in what its row says, ignoring case. */
export function eventSays(event: EventType, words: string): boolean {
  const asked = words.trim().toLowerCase();
  if (asked === '') return true;
  return [event.type, ...event.payload, event.meaning, event.producedBy, event.consumers].some((said) =>
    said.toLowerCase().includes(asked),
  );
}

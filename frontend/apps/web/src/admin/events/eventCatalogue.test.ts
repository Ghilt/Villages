import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { EVERY_EVENT_CARRIES, eventSays, parseEventCatalogue } from './eventCatalogue';

/** The repository's root, from this file's place in the tree. */
const ROOT = new URL('../../../../../../', import.meta.url);
const DOCUMENT = readFileSync(new URL('docs/EVENTS.md', ROOT), 'utf8');
const SAMPLES = new URL('contracts/fixtures/events/', ROOT);

const sections = parseEventCatalogue(DOCUMENT);
const types = sections.flatMap((section) => section.events);

describe('the event catalogue, as the events page reads it', () => {
  it('finds every row of docs/EVENTS.md under the heading it stands under', () => {
    const rows = DOCUMENT.split(/\r?\n/).filter((line) => line.startsWith('| `villages.'));
    expect(types.map((event) => event.type)).toEqual(rows.map((line) => /`([^`]+)`/.exec(line)![1]));
    expect(sections.map((section) => section.title)).toContain("The world's events");
    expect(sections.map((section) => section.title)).toContain("The player's events");
  });

  it('reads a row into its parts', () => {
    const founded = types.find((event) => event.type === 'villages.house.founded.v1')!;
    expect(founded).toMatchObject({ whose: 'house', verb: 'founded', version: 1 });
    expect(founded.payload).toEqual(expect.arrayContaining(['houseId', 'seat', ...EVERY_EVENT_CARRIES]));
    expect(founded.meaning).not.toBe('');
    expect(founded.producedBy).not.toBe('');
  });

  it('keeps what is said between a heading and its table', () => {
    const houses = sections.find((section) => section.title === "The world's events")!;
    expect(houses.said.join(' ')).toContain('One stream per house');
  });

  it('finds a type by a word of its row, whatever the case', () => {
    const founded = types.find((event) => event.type === 'villages.house.founded.v1')!;
    expect(eventSays(founded, 'BANNER')).toBe(true);
    expect(eventSays(founded, 'no such word anywhere')).toBe(false);
    expect(eventSays(founded, '  ')).toBe(true);
  });
});

/**
 * Every type the page lists has its sample, which the page unfolds under it, and every sample is of a type the page
 * lists: the Kotlin and TypeScript protocol tests read the samples, and this keeps the page's pairing of them whole.
 */
describe('the samples of the events', () => {
  const own = readdirSync(SAMPLES).filter((file) => file.endsWith('.json'));
  const cases = readdirSync(new URL('cases/', SAMPLES)).filter((file) => file.endsWith('.json'));
  const listed = types.map((event) => event.type);

  it('are one for every type, named for it', () => {
    expect(listed.filter((type) => !own.includes(`${type}.json`))).toEqual([]);
    expect(own.filter((file) => !listed.includes(file.replace(/\.json$/, '')))).toEqual([]);
  });

  it('are each of the type they are named for, carrying what its row says', () => {
    for (const event of types) {
      const sample = JSON.parse(readFileSync(new URL(`${event.type}.json`, SAMPLES), 'utf8')) as {
        type: string;
        data: Record<string, unknown>;
      };
      expect(sample.type, event.type).toBe(event.type);
      expect(
        Object.keys(sample.data).filter((field) => !event.payload.includes(field)),
        event.type,
      ).toEqual([]);
    }
  });

  it('in cases/ are each a case of a type listed', () => {
    expect(cases.filter((file) => !listed.some((type) => file.startsWith(`${type}.`)))).toEqual([]);
  });
});

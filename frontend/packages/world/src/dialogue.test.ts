import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseDialogue } from './dialogue.ts';

const fixture = readFileSync(
  new URL('../../../../contracts/fixtures/dialogue.json', import.meta.url),
  'utf8',
);
const letter = readFileSync(
  new URL('../../../../world/catalogues/dialogues/letter.json', import.meta.url),
  'utf8',
);

describe('a dialogue file', () => {
  it('reads the shared fixture as the server does, every kind of field once', () => {
    const dialogue = parseDialogue(fixture);

    expect(dialogue.title).toBe('A word at the gate');
    expect(dialogue.speakers.map((speaker) => speaker.who)).toEqual([
      { keyFigure: true },
      { name: 'The abbot', portrait: 'man-01' },
    ]);
    const [asks, give, keep, thanks] = dialogue.lines;
    expect(asks).toMatchObject({ then: ['give', 'keep'], shows: 'seat', says: '{given}, will you give?' });
    expect(give).toMatchObject({
      spends: { piety: 10 },
      reveals: [{ piety: -10 }, { influence: 3 }],
      then: 'thanks',
    });
    expect(keep).toMatchObject({ reveals: 'hidden', then: null });
    expect(thanks).toMatchObject({ grants: { influence: 3 }, shows: 'keyFigure' });
  });

  it('reads the letter', () => {
    expect(parseDialogue(letter).lines.map((line) => line.id)[0]).toBe('arrives');
  });

  it('refuses a field it cannot read, naming where', () => {
    expect(() => parseDialogue(fixture.replace('"shows": "seat"', '"shows": "sky"'))).toThrow(
      'world/catalogues/dialogues: no lines.asks.shows the page can read',
    );
  });
});

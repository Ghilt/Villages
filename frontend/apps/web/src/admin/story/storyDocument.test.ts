import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseStory, portraitsIn, saidIn, typeset } from './storyDocument';

/** The repository's root, from this file's place in the tree. */
const ROOT = new URL('../../../../../../', import.meta.url);
const DOCUMENT = readFileSync(new URL('docs/STORY.md', ROOT), 'utf8');

const SAMPLE = [
  '# The story',
  '',
  '## How it is kept',
  '',
  'Rules, which are not drawn, and a picture among them: ![A philosopher](../world/portraits/man-01.png).',
  '',
  '## The background',
  '',
  'How it came to be,',
  'in two lines.',
  '',
  '#### 1440 · The printing press',
  '',
  '### 1600 · The first light',
  '',
  'It began *here*.',
  '',
  '![A philosopher](../world/portraits/man-01.png)',
  '',
  '### Lore · What the gods are',
  '',
  'Energies.',
  '',
  '### The gods take fright',
  '',
  'They did.',
  '',
  '### 1 January 1790 · Now',
  '',
  '![One](../world/portraits/man-03.png) ![Two](../world/portraits/woman-01.png)',
].join('\n');

describe('the story, as its page reads it', () => {
  it('draws only the parts with boxes, each with its opening joined into one line', () => {
    const parts = parseStory(SAMPLE);
    expect(parts.map((part) => part.name)).toEqual(['The background']);
    expect(parts[0]!.opening).toEqual(['How it came to be, in two lines.']);
  });

  it('reads a box as its when and its name, lore as no date, a box without " · " as at no one time, and a #### as an invention', () => {
    const boxes = parseStory(SAMPLE)[0]!.boxes;
    expect(boxes.map(({ kind, when, name }) => ({ kind, when, name }))).toEqual([
      { kind: 'invention', when: '1440', name: 'The printing press' },
      { kind: 'event', when: '1600', name: 'The first light' },
      { kind: 'lore', when: null, name: 'What the gods are' },
      { kind: 'event', when: null, name: 'The gods take fright' },
      { kind: 'event', when: '1 January 1790', name: 'Now' },
    ]);
    expect(boxes[1]!.words).toEqual(['It began *here*.']);
  });

  it('reads a paragraph of pictures as a row of portraits, and a box of pictures alone as having no words', () => {
    const boxes = parseStory(SAMPLE)[0]!.boxes;
    expect(boxes[1]!.pictures).toEqual([[{ key: 'man-01', caption: 'A philosopher' }]]);
    expect(boxes[4]!.words).toEqual([]);
    expect(boxes[4]!.pictures).toEqual([
      [
        { key: 'man-03', caption: 'One' },
        { key: 'woman-01', caption: 'Two' },
      ],
    ]);
  });

  it('says the line of what it cannot read rather than skipping it', () => {
    expect(() => parseStory('### 1600 · Orphan')).toThrow('line 1: a box stands before any part');
    expect(() => parseStory('## A\n\n### · Nameless')).toThrow('line 3:');
    expect(() => parseStory('## A\n\n### 1 · B\n\nWords ![x](../world/portraits/man-01.png)')).toThrow(
      'line 5: a picture stands among words',
    );
    expect(() => parseStory('## A\n\n### 1 · B\n\n![x](../world/scenes/harbour.png)')).toThrow(
      'line 5: ../world/scenes/harbour.png is not a portrait',
    );
  });

  it('holds an invention to its year and its name, with nothing under them', () => {
    expect(() => parseStory('## A\n\n#### The printing press')).toThrow(
      'line 3: an invention wants its year',
    );
    expect(() => parseStory('## A\n\n#### Lore · The press')).toThrow('line 3: an invention wants its year');
    expect(() => parseStory('## A\n\n#### 1440 · The printing press\n\nGutenberg made it.')).toThrow(
      'line 5: an invention is its year and its name, and nothing under them',
    );
  });

  it('sets a spaced hyphen as a dash and curls an apostrophe, and leaves a hyphen in a word alone', () => {
    expect(typeset("the world's cities - not sacked - a well-made thing")).toBe(
      'the world’s cities – not sacked – a well-made thing',
    );
  });

  it('says italics where *a word* marks them', () => {
    expect(saidIn('before *yes* or *no*.')).toEqual([
      { text: 'before ', italic: false },
      { text: 'yes', italic: true },
      { text: ' or ', italic: false },
      { text: 'no', italic: true },
      { text: '.', italic: false },
    ]);
  });
});

describe('docs/STORY.md', () => {
  const parts = parseStory(DOCUMENT);

  it('reads by its own rules, and ends on a day: the present', () => {
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.at(-1)!.boxes.at(-1)!.when).not.toBeNull();
  });

  it('names only portraits that are in world/portraits/', () => {
    const missing = portraitsIn(parts).filter(
      (key) => !existsSync(new URL(`world/portraits/${key}.png`, ROOT)),
    );
    expect(missing).toEqual([]);
  });

  it('gives every picture words to be said under it', () => {
    const silent = parts.flatMap((part) =>
      part.boxes.flatMap((box) => box.pictures.flat().filter((picture) => picture.caption === '')),
    );
    expect(silent).toEqual([]);
  });
});

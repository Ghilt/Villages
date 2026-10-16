import { describe, expect, it } from 'vitest';

import type { Note } from '../../log/log';
import type { LogWindow } from '../../log/shared';
import { KEPT, areasOf, forget, hear, lineText, shownLines } from './heard';
import type { Choice, Heard } from './heard';

const game: LogWindow = { id: 'aaaa1111', address: '/', opened: 1000 };
const other: LogWindow = { id: 'bbbb2222', address: '/?at=48,11&zoom=10', opened: 2000 };
const said = (at: number, area: string, message: string): Note => ({ at, area, message });

const everything: Choice = { window: null, areas: new Set<string>(), words: '' };

describe('what the logs page holds', () => {
  it('takes on a window by its answer, and each note it says after', () => {
    let heard: Heard = [];
    heard = hear(heard, { kind: 'notes', window: game, notes: [said(1, 'world', 'drawing')] });
    heard = hear(heard, { kind: 'note', window: game, note: said(2, 'cells', 'twelve arrived') });
    expect(heard).toHaveLength(1);
    expect(heard[0]!.notes.map((note) => note.message)).toEqual(['drawing', 'twelve arrived']);
  });

  it('keeps what it heard when an answer holds less of it', () => {
    let heard: Heard = [];
    for (let at = 0; at < 300; at += 1)
      heard = hear(heard, { kind: 'note', window: game, note: said(at, 'a', 'x') });
    heard = hear(heard, { kind: 'notes', window: game, notes: [said(299, 'a', 'x')] });
    expect(heard[0]!.notes).toHaveLength(300);
  });

  it('keeps at most so many lines of a window', () => {
    let heard: Heard = [];
    for (let at = 0; at < KEPT + 5; at += 1) {
      heard = hear(heard, { kind: 'note', window: game, note: said(at, 'a', String(at)) });
    }
    expect(heard[0]!.notes).toHaveLength(KEPT);
    expect(heard[0]!.notes[0]!.message).toBe('5');
  });

  it('marks a window gone, keeping what it said, and ignores the going of one it never heard', () => {
    let heard: Heard = hear([], { kind: 'note', window: game, note: said(1, 'a', 'x') });
    heard = hear(heard, { kind: 'gone', window: game });
    expect(heard[0]).toMatchObject({ gone: true, notes: [said(1, 'a', 'x')] });
    expect(hear([], { kind: 'gone', window: other })).toEqual([]);
  });

  it('forgets every line when cleared, and keeps every window', () => {
    const heard = forget(hear([], { kind: 'note', window: game, note: said(1, 'a', 'x') }));
    expect(heard).toEqual([{ window: game, notes: [], gone: false }]);
  });
});

describe('the lines it shows', () => {
  let heard: Heard = [];
  heard = hear(heard, {
    kind: 'notes',
    window: game,
    notes: [
      said(10, 'world', 'drawing the master'),
      said(30, 'cells', 'twelve arrived'),
      said(30, 'cells', 'six more'),
    ],
  });
  heard = hear(heard, { kind: 'notes', window: other, notes: [said(20, 'structures', 'raised a mill')] });

  it('are every window, newest first, the later of one moment first', () => {
    expect(shownLines(heard, everything).map(({ note }) => note.message)).toEqual([
      'six more',
      'twelve arrived',
      'raised a mill',
      'drawing the master',
    ]);
  });

  it('are one window, the areas chosen, and the words asked for, whatever their case', () => {
    expect(shownLines(heard, { ...everything, window: other.id })).toHaveLength(1);
    expect(shownLines(heard, { ...everything, areas: new Set(['cells']) })).toHaveLength(2);
    expect(shownLines(heard, { ...everything, words: 'MILL' }).map(({ note }) => note.message)).toEqual([
      'raised a mill',
    ]);
  });

  it('count each area of the windows chosen', () => {
    expect(areasOf(heard, null)).toEqual([
      ['cells', 2],
      ['structures', 1],
      ['world', 1],
    ]);
    expect(areasOf(heard, game.id)).toEqual([
      ['cells', 2],
      ['world', 1],
    ]);
  });

  it('copy as the panel copies them, with the window when there are several', () => {
    const [newest] = shownLines(heard, everything);
    expect(lineText(newest!, false)).toMatch(/^\d\d:\d\d:\d\d cells: six more$/);
    expect(lineText(newest!, true)).toMatch(/^aaaa1111 \d\d:\d\d:\d\d cells: six more$/);
  });
});

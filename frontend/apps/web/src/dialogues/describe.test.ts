import { describe, expect, it } from 'vitest';

import type { DialogueView, LineView } from '@villages/protocol';

import { standing, whatChangedIn } from './describe';

function line(id: string): LineView {
  return { id, speaker: 'messenger', words: `The words of ${id}.` };
}

function letter(over: Partial<DialogueView> = {}): DialogueView {
  return {
    id: 'dd000000-0000-4000-8000-00000000a001',
    revision: 1,
    title: 'A letter from the coast',
    speakers: [{ id: 'messenger', party: 1, name: 'A messenger' }],
    said: [],
    next: [line('arrives'), line('reads')],
    options: [line('accept'), line('refuse')],
    ending: { kind: 'open' },
    ...over,
  };
}

describe('where a dialogue stands', () => {
  it('says what is left to read, and the dialogue choice it ends in', () => {
    expect(standing(letter())).toBe('2 lines to read, then a dialogue choice of 2');
    expect(standing(letter({ next: [] }))).toBe('waiting on a dialogue choice of 2');
    expect(standing(letter({ next: [line('paid')], options: [] }))).toBe(
      '1 line to read, up to the next step',
    );
  });

  it('says how it ended, and how much was said', () => {
    const said = [{ ...line('arrives'), effects: [] }];

    expect(standing(letter({ said, next: [], options: [], ending: { kind: 'completed' } }))).toBe(
      'finished, 1 line said',
    );
    expect(
      standing(
        letter({
          said,
          next: [],
          options: [],
          ending: { kind: 'lost', because: { kind: 'alive', character: 'x' } },
        }),
      ),
    ).toBe('lost, 1 line said');
  });
});

describe('what changed in the dialogues', () => {
  it('says every one on first hearing, and that there are none', () => {
    expect(whatChangedIn(null, [])).toEqual(['no dialogues yet']);
    expect(whatChangedIn(null, [letter()])).toEqual([
      '"A letter from the coast": 2 lines to read, then a dialogue choice of 2',
    ]);
  });

  it('after that, says only the ones offered or moved on', () => {
    const second = letter({ id: 'dd000000-0000-4000-8000-00000000a002', title: 'A second letter' });
    const moved = letter({ revision: 2, next: [line('paid')], options: [] });

    expect(whatChangedIn([letter()], [letter(), second])).toEqual([
      '"A second letter" offered: 2 lines to read, then a dialogue choice of 2',
    ]);
    expect(whatChangedIn([letter(), second], [moved, second])).toEqual([
      '"A letter from the coast": 1 line to read, up to the next step',
    ]);
  });

  it('says nothing when the same dialogues come again, as the requirements switch sends them', () => {
    const shown = letter({ requirements: [{ kind: 'alive', character: 'x' }] });

    expect(whatChangedIn([letter()], [shown])).toEqual([]);
  });
});

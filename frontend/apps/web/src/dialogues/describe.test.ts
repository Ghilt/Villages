import { describe, expect, it } from 'vitest';

import type { DialogueView, LineView } from '@villages/protocol';

import { impactWords, requirementWords, standing, whatChangedIn } from './describe';

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

describe('what an option shows it will do', () => {
  it('says what it gains and costs, in the words a player knows the resources by', () => {
    expect(
      impactWords({
        kind: 'shown',
        impacts: [
          { resource: 'wealth', amount: -40 },
          { resource: 'naturalDomain', amount: 100 },
        ],
      }),
    ).toBe('−40 wealth, +100 domain');
  });

  it('is unknown when hidden, and nothing when it shows nothing', () => {
    expect(impactWords({ kind: 'hidden' })).toBe('???');
    expect(impactWords(undefined)).toBeNull();
  });
});

describe('a requirement in words', () => {
  it('names a character by the speaker they are, and by their id when they do not speak', () => {
    const speakers = [{ id: 'figure', party: 0, name: 'Agnes Hollin', character: 'cb732500-39bd' }];

    expect(requirementWords({ kind: 'alive', character: 'cb732500-39bd' }, speakers)).toBe(
      'Agnes Hollin alive',
    );
    expect(requirementWords({ kind: 'alive', character: '2b0e34d7-8041' }, speakers)).toBe(
      'character 2b0e34d7 alive',
    );
  });
});

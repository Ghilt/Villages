import { describe, expect, it } from 'vitest';

import type { DialogueView, LineView, QuestView } from '@villages/protocol';

import {
  closingLine,
  gainsOf,
  gainWords,
  howMany,
  impactWords,
  listOf,
  questOf,
  refusalWords,
  showsWords,
  sideOf,
  signed,
  standing,
  whatChangedIn,
  whyLost,
} from './describe';

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

describe('how many there are', () => {
  it('counts the open ones as waiting, and the completed and the lost as finished', () => {
    const lost = letter({ ending: { kind: 'lost', because: { kind: 'alive', character: 'c' } } });

    expect(howMany([])).toBe('0 waiting, 0 finished');
    expect(howMany([letter(), letter({ ending: { kind: 'completed' } }), lost])).toBe(
      '1 waiting, 2 finished',
    );
  });
});

describe("the pane's list", () => {
  const frederick = { id: 'falk', party: 0, name: 'Frederick Falk', character: 'c-falk' };
  const messenger = { id: 'messenger', party: 1, name: 'A messenger' };
  const offered = (id: string, over: Partial<DialogueView> = {}) =>
    letter({ id, speakers: [frederick, messenger], ...over });

  it('puts the dialogues waiting above the ones finished, newest first in both', () => {
    const list = listOf([
      offered('first', { ending: { kind: 'completed' } }),
      offered('second'),
      offered('third', { ending: { kind: 'completed' } }),
      offered('fourth'),
    ]);

    expect(list.waiting.map((one) => one.id)).toEqual(['fourth', 'second']);
    expect(list.finished.map((one) => one.id)).toEqual(['third', 'first']);
  });

  // Each name stands alone, as on a bubble: "A messenger" is right there and wrong inside a sentence.
  it('names who speaks in one, each name standing alone', () => {
    const three = [frederick, messenger, { id: 'clerk', party: 1, name: 'A clerk' }];

    expect(listOf([offered('a')]).waiting[0]?.line).toBe('Frederick Falk · A messenger');
    expect(listOf([offered('a', { speakers: [messenger] })]).waiting[0]?.line).toBe('A messenger');
    expect(listOf([offered('a', { speakers: three })]).waiting[0]?.line).toBe(
      'Frederick Falk · A messenger · A clerk',
    );
  });

  // Begun is what the server knows: a step taken. Lines read and not stepped past are the browser's.
  it('says whether one waiting is new or begun', () => {
    const said = [{ ...line('arrives'), effects: [] }];

    expect(listOf([offered('a')]).waiting[0]?.progress).toBe('new');
    expect(listOf([offered('a', { said })]).waiting[0]?.progress).toBe('begun');
  });

  it('lists a lapsed one as finished, saying why in place of who', () => {
    const lapsed = listOf([
      offered('a', { ending: { kind: 'lost', because: { kind: 'alive', character: 'c-falk' } } }),
    ]).finished[0];

    expect(lapsed?.line).toBe('Frederick Falk died before it was finished');
    expect(lapsed?.lapsed).toBe(true);
    expect(lapsed?.progress).toBeNull();
  });
});

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
    ).toBe('lost, 1 line said: character x died');
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

  // A reconnect sends the list again, and nothing in it has moved.
  it('says nothing when the same dialogues come again', () => {
    expect(whatChangedIn([letter()], [letter()])).toEqual([]);
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

describe('what a line did to the house', () => {
  it('is a gain for a grant and a loss for a spend, each with its resource', () => {
    expect(
      gainsOf([
        { kind: 'spend', resource: 'wealth', amount: 40 },
        { kind: 'grant', resource: 'influence', amount: 5 },
      ]),
    ).toEqual([
      { resource: 'wealth', amount: -40 },
      { resource: 'influence', amount: 5 },
    ]);
    expect(gainsOf([])).toEqual([]);
  });

  it('is said with its sign, a true minus for a loss', () => {
    expect(signed(100)).toBe('+100');
    expect(signed(-40)).toBe('−40');
    expect(gainWords({ resource: 'wealth', amount: -40 })).toBe('−40 wealth');
  });
});

describe('how a lapsed dialogue closes', () => {
  it('says who died, by the name they speak under', () => {
    const speakers = [{ id: 'figure', party: 0, name: 'Agnes Hollin', character: 'cb732500-39bd' }];

    expect(closingLine({ kind: 'alive', character: 'cb732500-39bd' }, speakers)).toBe(
      'Sadly, Agnes Hollin died before this could be finished.',
    );
  });
});

describe('which side a speaker speaks from', () => {
  it('is one party on the left and the next on the right, whatever the numbers', () => {
    expect([0, 1, 2, 3, -1].map(sideOf)).toEqual(['left', 'right', 'left', 'right', 'right']);
  });
});

describe('what a line shows, in the log', () => {
  const speakers = [{ id: 'figure', party: 0, name: 'Philip Carrow', character: 'philip' }];

  it('says a place by where it is', () => {
    expect(showsWords({ kind: 'place', at: { lat: 60.7763, lon: 14.9267 } }, { speakers }, null)).toBe(
      'the place at 60.776, 14.927',
    );
  });

  it("names the player's own house, and any other by its id", () => {
    const yours = { id: 'fenwold-0000', name: 'Fenwold' };

    expect(showsWords({ kind: 'house', id: 'fenwold-0000' }, { speakers }, yours)).toBe('the house Fenwold');
    expect(showsWords({ kind: 'house', id: 'ravenscar' }, { speakers }, yours)).toBe('house ravensca');
  });

  it('names a character by the name they speak under in the dialogue', () => {
    expect(showsWords({ kind: 'character', id: 'philip' }, { speakers }, null)).toBe('Philip Carrow');
  });
});

describe('why a step was refused', () => {
  it('says a purse too light plainly, and anything else as not done', () => {
    expect(refusalWords('notEnoughFree')).toBe('You lack the resources to pay for that.');
    expect(refusalWords('somethingNobodyWrote')).toBe('That could not be done.');
  });
});

describe('why a dialogue was lost', () => {
  it('names a character by the speaker they are, and by their id when they do not speak', () => {
    const speakers = [{ id: 'figure', party: 0, name: 'Agnes Hollin', character: 'cb732500-39bd' }];

    expect(whyLost({ kind: 'alive', character: 'cb732500-39bd' }, speakers)).toBe('Agnes Hollin died');
    expect(whyLost({ kind: 'alive', character: '2b0e34d7-8041' }, speakers)).toBe('character 2b0e34d7 died');
  });
});

describe('the quest a dialogue is part of', () => {
  it('is the quest whose node leads to it, by id and title, and none for a dialogue no quest leads to', () => {
    const quests = [
      {
        id: 'q1',
        revision: 1,
        title: 'The abbot of the isle',
        nodes: [
          { id: 'gate', row: 0, state: 'done', kind: 'dialogue', title: 'The gate', dialogueId: 'd-gate' },
        ],
        edges: [],
        ending: { kind: 'open' },
      },
    ] as const satisfies readonly QuestView[];

    expect(questOf('d-gate', quests)).toEqual({ id: 'q1', title: 'The abbot of the isle' });
    expect(questOf('d-letter', quests)).toBeNull();
    expect(questOf('d-gate', null)).toBeNull();
  });
});

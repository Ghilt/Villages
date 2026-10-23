import { describe, expect, it } from 'vitest';
import type { QuestView } from '@villages/protocol';

import { challengeWords, kindWords, objectiveWords, standing, whatChangedIn } from './describe';

const abbot: QuestView = {
  id: 'q1',
  revision: 1,
  title: 'The abbot of the isle',
  nodes: [
    {
      id: 'gate',
      row: 0,
      state: 'current',
      kind: 'dialogue',
      title: 'The abbot at the gate',
      dialogueId: 'd1',
    },
    { id: 'gift', row: 1, state: 'ahead' },
  ],
  edges: [{ from: 'gate', to: 'gift', state: 'ahead' }],
  ending: { kind: 'open' },
};

const onTheLight: QuestView = {
  ...abbot,
  revision: 3,
  nodes: [
    { id: 'gate', row: 0, state: 'done', kind: 'dialogue', title: 'The abbot at the gate' },
    { id: 'gift', row: 1, state: 'lost', kind: 'checklist', title: 'A gift to the mission', objectives: [] },
    {
      id: 'light',
      row: 1,
      state: 'current',
      kind: 'checklist',
      title: 'A light on the water',
      objectives: [
        { kind: 'hold', id: 'castle', met: true, structureType: 'castle', where: 'island' },
        { kind: 'deliver', id: 'wealth', met: false, resource: 'wealth', amount: 60 },
      ],
    },
  ],
};

describe('where a quest stands, in the log', () => {
  it('names the node it stands at, a question mark as one, how much of a checklist is ticked, and the roads lost', () => {
    expect(standing(abbot)).toBe('stands at "The abbot at the gate"');
    expect(standing(onTheLight)).toBe(
      'stands at "A light on the water", 1 of 2 ticked; lost "A gift to the mission"',
    );
    expect(standing({ ...abbot, ending: { kind: 'completed' } })).toBe('finished');
  });

  it('says the first list whole, and after it only what was offered or moved on', () => {
    expect(whatChangedIn(null, [])).toEqual(['no quests yet']);
    expect(whatChangedIn([], [abbot])).toEqual([
      '"The abbot of the isle" offered: stands at "The abbot at the gate"',
    ]);
    expect(whatChangedIn([abbot], [abbot])).toEqual([]);
    expect(whatChangedIn([abbot], [onTheLight])).toHaveLength(1);
  });
});

describe("an objective in the player's words", () => {
  it("says what it asks, in the resource's own word", () => {
    expect(objectiveWords({ kind: 'deliver', id: 'w', met: false, resource: 'wealth', amount: 60 })).toBe(
      'Deliver 60 wealth',
    );
    expect(
      objectiveWords({ kind: 'pledge', id: 'p', met: false, resource: 'piety', amount: 30, months: 6 }),
    ).toBe('Pledge 30 piety for 6 months');
    expect(
      objectiveWords({ kind: 'hold', id: 'c', met: false, structureType: 'printingHouse', where: 'island' }),
    ).toBe('Hold a printing house on an island');
  });
});

describe('a challenge node in words', () => {
  const debate: QuestView = {
    id: 'q2',
    revision: 1,
    title: 'The debate in the square',
    nodes: [
      {
        id: 'square',
        row: 0,
        state: 'current',
        kind: 'challenge',
        title: "Brother Anselm's challenge",
        challenge: { kind: 'debate', against: { name: 'Brother Anselm', colour: '#a8452a' } },
      },
      { id: 'penance', row: 1, state: 'ahead', kind: 'checklist', title: 'A penance', objectives: [] },
      { id: 'blessing', row: 2, state: 'ahead' },
    ],
    edges: [
      { from: 'square', to: 'penance', state: 'ahead', verdict: 'lost' },
      { from: 'square', to: 'blessing', state: 'ahead', verdict: 'won' },
    ],
    ending: { kind: 'open' },
  };

  it('says what it puts to the house and who stands against it, and each road, the won road first', () => {
    expect(challengeWords(debate, debate.nodes[0]!)).toEqual({
      puts: 'A debate against Brother Anselm.',
      roads: ['Won: something not yet known', 'Lost: A penance'],
    });
  });

  it('is nothing for any other node', () => {
    expect(challengeWords(debate, debate.nodes[1]!)).toBeNull();
  });

  it('says a kind in words, and an article that fits it', () => {
    expect(kindWords('tradeWar')).toBe('trade war');
    expect(
      challengeWords(debate, {
        ...debate.nodes[0]!,
        challenge: { kind: 'even', against: { name: 'Fate', colour: '#000000' } },
      })?.puts,
    ).toBe('An even against Fate.');
  });
});

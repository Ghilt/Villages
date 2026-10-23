import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseQuest } from './quest.ts';

const fixture = readFileSync(new URL('../../../../contracts/fixtures/quest.json', import.meta.url), 'utf8');
const abbot = readFileSync(
  new URL('../../../../world/catalogues/quests/abbot.json', import.meta.url),
  'utf8',
);

describe('a quest file', () => {
  it('reads the shared fixture as the server does, every kind of node and objective once', () => {
    const quest = parseQuest(fixture);

    expect(quest.title).toBe('A road to the sea');
    expect(quest.shownFromTheStart).toBe(true);
    const [talk, give, hold, dare, prize] = quest.nodes;
    expect(talk).toMatchObject({
      is: { kind: 'dialogue', dialogue: 'a-word' },
      then: [
        { to: 'give', endings: ['yes'] },
        { to: 'hold', endings: ['no'] },
      ],
    });
    expect(give!.is).toEqual({
      kind: 'objectives',
      objectives: [
        { id: 'coin', kind: 'delivers', resource: 'wealth', amount: 5 },
        { id: 'oath', kind: 'pledges', resource: 'piety', amount: 3, months: 2 },
      ],
    });
    expect(hold).toMatchObject({ hidden: true, then: [{ to: 'dare', endings: [] }] });
    expect(hold!.is).toEqual({
      kind: 'objectives',
      objectives: [
        { id: 'mill', kind: 'holds', structure: 'mill', onAnIsland: false },
        { id: 'fort', kind: 'holds', structure: 'castle', onAnIsland: true },
      ],
    });
    expect(dare).toMatchObject({
      then: [
        { to: 'prize', endings: [], verdict: 'won' },
        { to: 'give', endings: [], verdict: 'lost' },
      ],
    });
    expect(dare!.is).toEqual({
      kind: 'challenge',
      challenge: {
        kind: 'debate',
        against: { name: 'A rival', colour: '#a8452a' },
        slices: [
          {
            aspect: 'reason',
            power: 50,
            integrity: 46,
            summonCount: 3,
            effects: ['reason.counsel', 'reason.doubt'],
            slotted: {
              'reason.counsel': {
                kind: 'keyFigure',
                name: 'A scholar',
                stats: { piety: 8, reason: 16, kindness: 9, physical: 7 },
              },
            },
          },
          {
            aspect: 'holy',
            power: 50,
            integrity: 50,
            summonCount: 3,
            effects: ['holy.ordination', 'holy.sanctuary'],
            slotted: { 'holy.sanctuary': { kind: 'building', name: 'A chapel', level: 1 } },
          },
        ],
      },
    });
    expect(prize).toMatchObject({ shownAhead: true, is: { kind: 'reward', gives: { reason: 7 } } });
  });

  it('refuses a challenge led on by anything but won or lost', () => {
    expect(() => parseQuest(fixture.replace('"prize": ["won"]', '"prize": ["drawn"]'))).toThrow(
      'world/catalogues/quests: no nodes.dare.then.prize won or lost the page can read',
    );
  });

  it('reads the abbot', () => {
    expect(parseQuest(abbot).nodes.map((node) => node.id)).toEqual([
      'gate',
      'gift',
      'light',
      'consecration',
      'blessing',
    ]);
  });

  it('refuses a node that is two things, naming it', () => {
    expect(() =>
      parseQuest(fixture.replace('"gives": { "reason": 7 }', '"gives": { "reason": 7 }, "dialogue": "x"')),
    ).toThrow(
      'world/catalogues/quests: no nodes.prize.dialogue, objectives, gives or challenge, and only one, the page can read',
    );
  });
});

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
    const [talk, give, hold, prize] = quest.nodes;
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
    expect(hold).toMatchObject({ hidden: true, then: [{ to: 'prize', endings: [] }] });
    expect(hold!.is).toEqual({
      kind: 'objectives',
      objectives: [
        { id: 'mill', kind: 'holds', structure: 'mill', onAnIsland: false },
        { id: 'fort', kind: 'holds', structure: 'castle', onAnIsland: true },
      ],
    });
    expect(prize).toMatchObject({ shownAhead: true, is: { kind: 'reward', gives: { reason: 7 } } });
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
      'world/catalogues/quests: no nodes.prize.dialogue, objectives or gives, and only one, the page can read',
    );
  });
});

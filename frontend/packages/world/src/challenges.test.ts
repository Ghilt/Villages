import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ASPECTS, antiOf, filledIn, parseChallenges } from './challenges.ts';

const fixture = readFileSync(
  new URL('../../../../contracts/fixtures/challenges.json', import.meta.url),
  'utf8',
);
const world = readFileSync(new URL('../../../../world/catalogues/challenges.json', import.meta.url), 'utf8');

describe("the challenge's content", () => {
  it('reads the shared fixture as the server does', () => {
    const challenges = parseChallenges(fixture);

    expect(challenges.effects.map((effect) => effect.id)).toEqual([
      'violence.sellswords',
      'violence.noQuarter',
      'reason.counsel',
      'holy.sanctuary',
    ]);
    expect(challenges.effects[0]).toMatchObject({
      fires: 'trigger',
      summons: 'mercenary',
      slot: null,
      needs: 'match',
    });
    expect(challenges.effects[1]!.numbers).toEqual({ chance: 25 });
    expect(challenges.effects[1]!.needs).toBeNull();
    expect(challenges.effects[2]!.slot).toEqual({ fits: 'keyFigure', lends: 'reason', onTheLine: false });
    expect(challenges.effects[3]!.slot).toEqual({ fits: 'structure', lends: null, onTheLine: true });
    expect(challenges.summons.find((summon) => summon.id === 'collector')).toMatchObject({
      aspect: 'greed',
      numbers: { costs: 3, deposits: 6.5 },
      needs: null,
    });
    expect(challenges.summons.find((summon) => summon.id === 'mercenary')!.needs).toBe('anti');
    expect(challenges.effects[1]!.puts).toBe('weakened');
    expect(challenges.effects[0]!.puts).toBeNull();
    expect(challenges.summons.find((summon) => summon.id === 'collector')!.puts).toBe('hastened');
    expect(challenges.buffs).toEqual([
      {
        id: 'hastened',
        name: 'Hastened',
        on: ['summon', 'slice'],
        words: 'Acts again, {rate}% of seconds.',
        numbers: { rate: 50 },
      },
    ]);
    expect(challenges.debuffs[0]).toMatchObject({ id: 'weakened', on: ['slice'], numbers: { percent: 25 } });
    expect(challenges.said.debuffs).toBe('One debuff.');
    expect(challenges.kinds[0]).toMatchObject({ seconds: [30, 90], happenings: [3, 6], twoAspects: 20 });
    expect(challenges.kinds[0]!.weights).toMatchObject({ violence: 8, holy: 1, reason: 0 });
    expect(challenges.said.summons).toBe('Two summons.');
    expect(challenges.startingSlices).toEqual([
      {
        id: 'chaplain',
        aspect: 'holy',
        power: 50,
        integrity: 50,
        summonCount: 3,
        effects: ['holy.sanctuary'],
        slotted: { 'holy.sanctuary': { kind: 'building', name: 'The chapel', level: 1 } },
      },
      {
        id: 'scholar',
        aspect: 'reason',
        power: 50,
        integrity: 46,
        summonCount: 2,
        effects: ['reason.counsel'],
        slotted: {},
      },
    ]);
  });

  it('reads the real one, three or four effects to every aspect', () => {
    const challenges = parseChallenges(world);
    expect(
      ASPECTS.map((aspect) => challenges.effects.filter((effect) => effect.aspect === aspect).length),
    ).toEqual(ASPECTS.map((aspect) => (['reason', 'authority'].includes(aspect) ? 5 : 4)));
  });

  it('refuses a field it cannot read, naming where', () => {
    expect(() => parseChallenges(fixture.replace('"passive"', '"sometimes"'))).toThrow(
      'world/catalogues/challenges.json: no effects.violence.noQuarter.fires the page can read',
    );
    expect(() => parseChallenges(fixture.replace('"needs": "match"', '"needs": "never"'))).toThrow(
      'world/catalogues/challenges.json: no effects.violence.sellswords.needs the page can read',
    );
  });

  it("pairs every aspect with its anti-aspect, and fills an effect's words with its numbers", () => {
    expect(antiOf('violence')).toBe('diplomacy');
    expect(antiOf('reason')).toBe('holy');
    expect(ASPECTS.every((aspect) => antiOf(antiOf(aspect)) === aspect)).toBe(true);
    expect(filledIn('{chance}% to kill, {missing} left', { chance: 25 })).toBe('25% to kill, {missing} left');
  });
});

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
      matching: true,
    });
    expect(challenges.effects[1]!.numbers).toEqual({ chance: 25 });
    expect(challenges.effects[1]!.matching).toBe(false);
    expect(challenges.effects[2]!.slot).toEqual({ fits: 'keyFigure', lends: 'reason', onTheLine: false });
    expect(challenges.effects[3]!.slot).toEqual({ fits: 'structure', lends: null, onTheLine: true });
    expect(challenges.summons.find((summon) => summon.id === 'collector')).toMatchObject({
      aspect: 'greed',
      numbers: { costs: 3, deposits: 6.5 },
      matching: false,
    });
    expect(challenges.summons.find((summon) => summon.id === 'mercenary')!.matching).toBe(true);
    expect(challenges.kinds[0]).toMatchObject({ seconds: [30, 90], happenings: [3, 6], twoAspects: 20 });
    expect(challenges.kinds[0]!.weights).toMatchObject({ violence: 8, holy: 1, reason: 0 });
    expect(challenges.said.summons).toBe('Two summons.');
  });

  it('reads the real one, three effects to every aspect', () => {
    const challenges = parseChallenges(world);
    expect(
      ASPECTS.map((aspect) => challenges.effects.filter((effect) => effect.aspect === aspect).length),
    ).toEqual(ASPECTS.map(() => 3));
  });

  it('refuses a field it cannot read, naming where', () => {
    expect(() => parseChallenges(fixture.replace('"passive"', '"sometimes"'))).toThrow(
      'world/catalogues/challenges.json: no effects.violence.noQuarter.fires the page can read',
    );
    expect(() => parseChallenges(fixture.replace('"matching": true', '"matching": "yes"'))).toThrow(
      'world/catalogues/challenges.json: no effects.violence.sellswords.matching the page can read',
    );
  });

  it("pairs every aspect with its anti-aspect, and fills an effect's words with its numbers", () => {
    expect(antiOf('violence')).toBe('diplomacy');
    expect(antiOf('reason')).toBe('holy');
    expect(ASPECTS.every((aspect) => antiOf(antiOf(aspect)) === aspect)).toBe(true);
    expect(filledIn('{chance}% to kill, {missing} left', { chance: 25 })).toBe('25% to kill, {missing} left');
  });
});

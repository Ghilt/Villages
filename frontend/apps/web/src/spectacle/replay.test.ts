import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { MomentView, SliceView } from '@villages/protocol';
import { parseChallenges } from '@villages/world';

import { foldTo, replayOf } from './replay';
import type { Field, Run, SideKey } from './replay';

const content = parseChallenges(
  readFileSync(new URL('../../../../../world/catalogues/challenges.json', import.meta.url), 'utf8'),
);

const slice = (aspect: string, effects: string[]): SliceView => ({
  aspect,
  power: 50,
  integrity: 50,
  summonCount: 3,
  effects,
  slotted: {},
});

const SIDES: Record<SideKey, readonly SliceView[]> = {
  a: [slice('holy', ['holy.ordination', 'holy.sanctuary'])],
  b: [
    slice('reason', ['reason.counsel', 'reason.doubt']),
    slice('authority', ['authority.watch', 'authority.curfew']),
  ],
};

let tug = 0;
/** One moment of the run below, its tug carried on from the one before. */
function moment(second: number, what: string, actor: string, more: Partial<MomentView> = {}): MomentView {
  tug += more.tugDelta ?? 0;
  return {
    second,
    happening: second < 5 ? 0 : 1,
    side: null,
    actor,
    what,
    effect: null,
    target: null,
    amount: null,
    boosted: false,
    tugDelta: 0,
    tugAfter: tug,
    targetEffect: null,
    status: null,
    ...more,
  };
}

/** Ten seconds of Holy and then Reason, in which everything that can change the field changes it once. */
const RUN: Run = {
  progression: { seconds: 10, happenings: [['holy'], ['reason']] },
  summons: [
    { serial: 1, kind: 'priest', called: null },
    { serial: 2, kind: 'onTheLine', called: 'the Cathedral of Varga' },
    { serial: 3, kind: 'enforcer', called: null },
  ],
  moments: [
    moment(0, 'happeningBegan', 'challenge'),
    moment(0, 'matches', 'a1', { side: 'a' }),
    moment(0, 'summoned', 'a1', { side: 'a', target: '#1', effect: 'holy.ordination' }),
    moment(0, 'buffed', 'challenge', { side: 'a', target: '#1', status: 'empowered', amount: 4 }),
    moment(0, 'arrived', '#2', { side: 'a', effect: 'holy.sanctuary', amount: 15, tugDelta: 15 }),
    moment(1, 'pulled', '#1', { side: 'a', tugDelta: 3 }),
    moment(1, 'debuffed', 'b1', {
      side: 'b',
      target: '#1',
      status: 'weakened',
      amount: 2,
      effect: 'reason.doubt',
    }),
    moment(2, 'pulled', '#1', { side: 'a', tugDelta: 2 }),
    moment(4, 'lifted', '#1', { side: 'a', status: 'weakened' }),
    moment(5, 'happeningBegan', 'challenge'),
    moment(5, 'summoned', 'b2', { side: 'b', target: '#3', effect: 'authority.watch' }),
    moment(5, 'pulled', 'b1', { side: 'b', tugDelta: -6 }),
    moment(6, 'killed', '#1', { side: 'a', target: '#3' }),
    moment(7, 'turned', 'b1', { side: 'b', target: '#1' }),
    moment(9, 'deserted', 'b1', { side: 'a', target: '#1' }),
  ],
  outcome: { tug: 14, ended: 'timeRanOut', second: 9, wonBy: 'a', gains: [], losses: [] },
};

/** A field as plain data, so two can be compared whole. */
const plain = (field: Field) => ({ ...field, pulled: [...field.pulled.entries()] });

describe('a run folded second by second', () => {
  const replay = replayOf(RUN, SIDES, content);

  it('is the same at every second however it is reached: played through, or folded from nothing', () => {
    for (let second = 0; second <= replay.last; second += 1) {
      expect(plain(replay.at(second))).toEqual(plain(foldTo(RUN, SIDES, content, second)));
    }
  });

  it('stands a summon on its hiring slice’s side, and a thing on the line on its own', () => {
    const first = replay.at(0);
    expect(first.standing.map((one) => [one.serial, one.name, one.side, one.aspect, one.onTheLine])).toEqual([
      [1, 'Priest', 'a', 'holy', false],
      [2, 'the Cathedral of Varga', 'a', 'holy', true],
    ]);
  });

  it('bears a buff and a debuff until their seconds run out, or until they are lifted', () => {
    const borne = (second: number) => replay.at(second).standing.find((one) => one.serial === 1)?.bearing;
    expect(borne(0)).toEqual([{ id: 'empowered', until: 4 }]);
    expect(borne(1)).toEqual([
      { id: 'empowered', until: 4 },
      { id: 'weakened', until: 3 },
    ]);
    expect(borne(3)?.map((bearing) => bearing.id)).toEqual(['empowered', 'weakened']);
    expect(borne(4)).toEqual([{ id: 'empowered', until: 4 }]);
    expect(borne(5)).toEqual([]);
  });

  it('says what each pulled in a second, and the tug the engine said after it', () => {
    expect(replay.at(1).pulled.get('#1')).toBe(3);
    expect(replay.at(5).pulled.get('b1')).toBe(-6);
    expect(replay.tug).toEqual([15, 18, 20, 20, 20, 14, 14, 14, 14, 14]);
    expect(replay.at(replay.last).tug).toBe(RUN.outcome.tug);
  });

  it('lays a killed summon down for three seconds as it fades, and lets a deserter go at once', () => {
    expect(replay.at(6).standing.find((one) => one.serial === 3)?.fell).toBe(6);
    expect(replay.at(8).standing.some((one) => one.serial === 3)).toBe(true);
    expect(replay.at(9).standing.some((one) => one.serial === 3)).toBe(false);
    expect(replay.at(7).standing.find((one) => one.serial === 1)?.side).toBe('b');
    expect(replay.at(9).standing.some((one) => one.serial === 1)).toBe(false);
  });

  it('says whether each slice can work in the happening going on', () => {
    const states = (second: number) =>
      [...replay.at(second).slices.a, ...replay.at(second).slices.b].map((one) => [one.actor, one.state]);
    expect(states(0)).toEqual([
      ['a1', 'matching'],
      ['b1', 'answering'],
      ['b2', 'idle'],
    ]);
    expect(states(5)).toEqual([
      ['a1', 'idle'],
      ['b1', 'matching'],
      ['b2', 'idle'],
    ]);
    expect(replay.at(5).happening).toEqual({ index: 1, aspects: ['reason'], from: 5, to: 10 });
  });

  it('refuses a summon the run does not name', () => {
    const stray: Run = {
      ...RUN,
      moments: [moment(0, 'summoned', 'a1', { side: 'a', target: '#9', effect: 'holy.ordination' })],
    };
    expect(() => replayOf(stray, SIDES, content)).toThrow('#9');
  });
});

describe('the fixture both ends are held to', () => {
  const frame = JSON.parse(
    readFileSync(
      new URL('../../../../../contracts/fixtures/frames/server/challengeSimulated.json', import.meta.url),
      'utf8',
    ),
  ) as Run;
  const sides: Record<SideKey, readonly SliceView[]> = {
    a: [slice('violence', ['violence.sellswords', 'violence.noQuarter'])],
    b: [slice('holy', ['holy.ordination', 'holy.sanctuary'])],
  };
  const replay = replayOf(frame, sides, content);

  it('reads, its tug at each second the last the engine said; a sample of the shape, not a fought run', () => {
    for (let second = 0; second <= replay.last; second += 1) {
      const said = frame.moments.filter((one) => one.second <= second).at(-1)?.tugAfter ?? 0;
      expect(replay.at(second).tug).toBe(said);
    }
  });
});

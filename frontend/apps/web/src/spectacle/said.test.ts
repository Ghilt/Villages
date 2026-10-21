import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { MomentView, SliceView } from '@villages/protocol';
import { parseChallenges } from '@villages/world';

import { momentSaid, summonNames } from './said';

const content = parseChallenges(
  readFileSync(new URL('../../../../../world/catalogues/challenges.json', import.meta.url), 'utf8'),
);

const slice = (aspect: string): SliceView => ({
  aspect,
  power: 50,
  integrity: 50,
  summonCount: 3,
  effects: [],
  slotted: {},
});
const SIDES = { a: [slice('holy')], b: [slice('reason')] };
const CALLED = summonNames([{ serial: 1, kind: 'priest', called: null }], content);

const moment = (more: Partial<MomentView>): MomentView => ({
  second: 3,
  happening: 0,
  side: 'a',
  actor: 'a1',
  what: 'pulled',
  effect: null,
  target: null,
  amount: null,
  boosted: false,
  tugDelta: 0,
  tugAfter: 0,
  targetEffect: null,
  status: null,
  ...more,
});

describe('a moment in words', () => {
  it('says who did it and what, by which effect', () => {
    expect(
      momentSaid(
        moment({ actor: 'a1', what: 'summoned', effect: 'holy.ordination', target: '#1' }),
        SIDES,
        CALLED,
        content,
      ),
    ).toBe('a1 holy summoned · Ordination → #1 Priest');
  });

  it('names the buff or the debuff put on, and whom it is on', () => {
    expect(
      momentSaid(
        moment({ actor: 'b1', what: 'debuffed', status: 'weakened', target: '#1', effect: 'reason.doubt' }),
        SIDES,
        CALLED,
        content,
      ),
    ).toBe('b1 reason debuffed: Weakened · Sow Doubt → #1 Priest');
  });

  it('says a happening beginning with nobody doing it', () => {
    expect(
      momentSaid(moment({ actor: 'challenge', what: 'happeningBegan', side: null }), SIDES, CALLED, content),
    ).toBe('happening began');
  });
});

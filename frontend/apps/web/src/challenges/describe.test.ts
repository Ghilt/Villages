import { describe, expect, it } from 'vitest';
import type { ChallengeRowView, ChallengeRunFrame, QuestView } from '@villages/protocol';
import type { Challenges } from '@villages/world';

import {
  anyWaiting,
  bringing,
  effectsSaid,
  firstWaiting,
  foughtFor,
  historyLine,
  historySaid,
  kindSaid,
  housesOf,
  newestFirst,
  nextSaid,
  replaySaid,
  resultSaid,
  thenSaid,
  waitingAt,
  watchingSaid,
  whatChangedIn,
} from './describe';

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
  ],
  edges: [{ from: 'square', to: 'penance', state: 'ahead', verdict: 'lost' }],
  ending: { kind: 'open' },
};

const movedOn: QuestView = {
  ...debate,
  revision: 2,
  nodes: [
    { ...debate.nodes[0]!, state: 'done' },
    { ...debate.nodes[1]!, state: 'current' },
  ],
};

describe('a challenge waiting to be chosen for', () => {
  it('is the one asked while its quest is open and stands at it, and nothing once it has moved on', () => {
    expect(waitingAt([debate], { questId: 'q2', nodeId: 'square' })?.node.id).toBe('square');
    expect(waitingAt([movedOn], { questId: 'q2', nodeId: 'square' })).toBeNull();
    expect(waitingAt([debate], { questId: 'q2', nodeId: 'penance' })).toBeNull();
    expect(
      waitingAt([{ ...debate, ending: { kind: 'completed' } }], { questId: 'q2', nodeId: 'square' }),
    ).toBeNull();
    expect(waitingAt([debate], null)).toBeNull();
  });

  it('is reason enough for the pane to stand while any open quest stands at one', () => {
    expect(anyWaiting([debate])).toBe(true);
    expect(anyWaiting([movedOn])).toBe(false);
  });
});

describe('the slices brought', () => {
  it('takes one pressed in or out, never more than three, never one twice', () => {
    expect(bringing([], 'scholar')).toEqual(['scholar']);
    expect(bringing(['scholar'], 'scholar')).toEqual([]);
    expect(bringing(['a', 'b', 'c'], 'd')).toEqual(['a', 'b', 'c']);
  });

  it("says a slice's effects by their names in the catalogue", () => {
    const content = {
      effects: [
        { id: 'reason.refutation', name: 'Refutation' },
        { id: 'reason.foresight', name: 'Foresight' },
      ],
    } as unknown as Challenges;
    expect(effectsSaid(['reason.refutation', 'reason.foresight'], content)).toBe('Refutation and Foresight');
    expect(effectsSaid(['reason.refutation'], content)).toBe('Refutation');
    expect(effectsSaid(['unknown.one'], content)).toBe('unknown.one');
  });
});

const fought: ChallengeRowView = {
  id: 'c1',
  revision: 1,
  title: "Brother Anselm's challenge",
  quest: 'The debate in the square',
  questId: 'q2',
  nodeId: 'square',
  kind: 'debate',
  house: 'Ravenscar',
  against: { name: 'Brother Anselm', colour: '#a8452a' },
  brought: ['scholar', 'almoner'],
  outcome: { tug: 41.46, ended: 'timeRanOut', second: 30, wonBy: 'a', gains: [], losses: [] },
  foughtAt: '2026-10-23T12:00:00Z',
};

describe('the history', () => {
  it('says who stood against whom, the kind, who won and how it ended, in one line', () => {
    expect(historyLine(fought)).toBe(
      'Ravenscar against Brother Anselm, a debate, won by Ravenscar: time ran out in second 30, 41.5 toward Ravenscar',
    );
    expect(
      historyLine({
        ...fought,
        kind: 'audienceAtCourt',
        outcome: { ...fought.outcome, ended: 'pulled', second: 12, tug: -100, wonBy: 'b' },
      }),
    ).toBe(
      'Ravenscar against Brother Anselm, an audience at court, won by Brother Anselm: pulled to the end in second 12',
    );
    expect(historyLine({ ...fought, outcome: { ...fought.outcome, tug: 0, wonBy: null } })).toBe(
      'Ravenscar against Brother Anselm, a debate, won by nobody: time ran out in second 30, even',
    );
  });

  it('names where the quest went on to once the move is heard, and nothing before', () => {
    expect(thenSaid(fought)).toBeNull();
    expect(thenSaid({ ...fought, then: "The brother's blessing" })).toBe(
      "The debate in the square went on to The brother's blessing.",
    );
  });

  it('says a row whole, its line ended and the road after it', () => {
    expect(historySaid(fought)).toBe(`${historyLine(fought)}.`);
    expect(historySaid({ ...fought, then: 'The spoils' })).toBe(
      `${historyLine(fought)}. The debate in the square went on to The spoils.`,
    );
  });

  it('reads newest first, and says a kind from its catalogue name', () => {
    const later = { ...fought, id: 'c2' };
    expect(newestFirst([fought, later]).map((row) => row.id)).toEqual(['c2', 'c1']);
    expect(kindSaid('tradeWar')).toBe('trade war');
  });

  it('is logged by what changed: the first in a line, then each fought, then each road heard', () => {
    expect(whatChangedIn(null, [])).toEqual(['no challenges fought yet']);
    expect(whatChangedIn([], [fought])).toEqual([
      `fought "Brother Anselm's challenge": ${historyLine(fought)}`,
    ]);
    const moved = { ...fought, revision: 2, then: "The brother's blessing" };
    expect(whatChangedIn([fought], [moved])).toEqual([
      "The debate in the square went on to The brother's blessing.",
    ]);
    expect(whatChangedIn([moved], [moved])).toEqual([]);
  });

  it('puts a challenge waiting first: the first open quest standing at one', () => {
    expect(firstWaiting([movedOn, debate])?.quest.revision).toBe(1);
    expect(firstWaiting([movedOn])).toBeNull();
  });
});

describe('a challenge watched', () => {
  const run: ChallengeRunFrame = {
    type: 'challengeRun',
    id: 'c1',
    sides: { a: [], b: [] },
    progression: { seconds: 30, happenings: [['reason']] },
    outcome: fought.outcome,
    moments: [
      {
        second: 0,
        happening: 0,
        side: null,
        actor: 'challenge',
        what: 'happeningBegan',
        effect: null,
        target: null,
        amount: null,
        boosted: false,
        tugDelta: 0,
        tugAfter: 0,
        targetEffect: null,
        status: null,
      },
    ],
    summons: [],
    differs: false,
  };

  it('is the one newly fought for the challenge accepted, once it is in the history', () => {
    expect(foughtFor([fought], { questId: 'q2', nodeId: 'square' })?.id).toBe('c1');
    expect(foughtFor([], { questId: 'q2', nodeId: 'square' })).toBeNull();
    expect(foughtFor([fought], null)).toBeNull();
  });

  it('stands the house on the first side in its lapis, and who stood against it on the second in their colour', () => {
    expect(housesOf(fought)).toEqual({
      a: { name: 'Ravenscar', colour: '#3d6aa6' },
      b: { name: 'Brother Anselm', colour: '#a8452a' },
    });
  });

  it('ends in a result: who won, how, what each side gained and lost, and where the quest goes on to', () => {
    const lost: ChallengeRowView = {
      ...fought,
      then: 'A penance',
      outcome: {
        tug: -100,
        ended: 'pulled',
        second: 16,
        wonBy: 'b',
        gains: [{ side: 'b', resource: 'piety', amount: 5, effect: 'holy.sanctuary' }],
        losses: [
          {
            side: 'a',
            name: 'the chapel',
            became: 'damaged',
            effectiveness: 10,
            effect: 'reason.refutation',
          },
        ],
      },
    };
    expect(resultSaid(lost)).toEqual({
      won: 'Brother Anselm won',
      how: 'Pulled to the end in second 16.',
      spoils: ['Brother Anselm: 5 piety gained', 'Ravenscar: the chapel damaged'],
    });
    expect(nextSaid(lost)).toBe('The debate in the square goes on to A penance.');
    expect(nextSaid(fought)).toBeNull();
    expect(resultSaid({ ...fought, outcome: { ...fought.outcome, tug: 0, wonBy: null } }).won).toBe(
      'Nobody won',
    );
  });

  it('says when fought again it comes out otherwise, or cannot be fought again, and nothing when it is the same', () => {
    expect(replaySaid(run)).toBeNull();
    expect(replaySaid({ ...run, differs: true })).toMatch(/comes out otherwise; what was recorded stands/);
    expect(replaySaid({ ...run, differs: true, moments: [] })).toMatch(/cannot be watched again/);
  });

  it('is logged by its title', () => {
    expect(watchingSaid(run, [fought])).toBe(`watching "Brother Anselm's challenge"`);
    expect(watchingSaid({ ...run, differs: true }, null)).toBe(
      'watching "a challenge", which comes out otherwise now than recorded',
    );
  });
});

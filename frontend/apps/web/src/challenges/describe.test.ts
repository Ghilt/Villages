import { describe, expect, it } from 'vitest';
import type { ChallengeRowView, QuestView } from '@villages/protocol';
import type { Challenges } from '@villages/world';

import {
  anyWaiting,
  bringing,
  effectsSaid,
  firstWaiting,
  historyLine,
  historySaid,
  kindSaid,
  newestFirst,
  thenSaid,
  waitingAt,
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

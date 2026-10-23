import { describe, expect, it } from 'vitest';
import type { QuestView } from '@villages/protocol';
import type { Challenges } from '@villages/world';

import { anyWaiting, bringing, effectsSaid, waitingAt } from './describe';

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

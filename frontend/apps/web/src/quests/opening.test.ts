import { describe, expect, it } from 'vitest';
import type { QuestView } from '@villages/protocol';

import { arrivals, questDialogues } from './opening';

const quest = (id: string, ending: QuestView['ending'] = { kind: 'open' }): QuestView => ({
  id,
  revision: 1,
  title: `Quest ${id}`,
  nodes: [
    { id: 'gate', row: 0, state: 'current', kind: 'dialogue', title: 'The gate', dialogueId: `d-${id}` },
    { id: 'gift', row: 1, state: 'ahead' },
  ],
  edges: [{ from: 'gate', to: 'gift', state: 'ahead' }],
  ending,
});

describe('a quest arriving', () => {
  it('is an open quest this page has not been shown, once in the life of the page', () => {
    const seen = new Set<string>();

    expect(arrivals(seen, [quest('a')]).map((one) => one.id)).toEqual(['a']);
    expect(arrivals(seen, [quest('a')])).toEqual([]);
    expect(arrivals(seen, [quest('a'), quest('b')]).map((one) => one.id)).toEqual(['b']);
  });

  it('is never a quest that has ended', () => {
    expect(arrivals(new Set(), [quest('c', { kind: 'completed' })])).toEqual([]);
  });
});

describe("a quest's dialogues", () => {
  it('are every dialogue its nodes lead to, which arrive through the quest rather than on their own', () => {
    expect(questDialogues([quest('a'), quest('b')])).toEqual(new Set(['d-a', 'd-b']));
    expect(questDialogues(null)).toEqual(new Set());
  });
});

import { describe, expect, it } from 'vitest';
import type { QuestView } from '@villages/protocol';

import { standing, whatChangedIn } from './describe';

const abbot: QuestView = {
  id: 'q1',
  revision: 1,
  title: 'The abbot of the isle',
  nodes: [
    {
      id: 'gate',
      row: 0,
      state: 'current',
      kind: 'dialogue',
      title: 'The abbot at the gate',
      dialogueId: 'd1',
    },
    { id: 'gift', row: 1, state: 'ahead' },
  ],
  edges: [{ from: 'gate', to: 'gift', state: 'ahead' }],
  ending: { kind: 'open' },
};

const onTheLight: QuestView = {
  ...abbot,
  revision: 3,
  nodes: [
    { id: 'gate', row: 0, state: 'done', kind: 'dialogue', title: 'The abbot at the gate' },
    { id: 'gift', row: 1, state: 'lost', kind: 'checklist', title: 'A gift to the mission', objectives: [] },
    {
      id: 'light',
      row: 1,
      state: 'current',
      kind: 'checklist',
      title: 'A light on the water',
      objectives: [
        { kind: 'hold', id: 'castle', met: true, structureType: 'castle', where: 'island' },
        { kind: 'deliver', id: 'wealth', met: false, resource: 'wealth', amount: 60 },
      ],
    },
  ],
};

describe('where a quest stands, in the log', () => {
  it('names the node it stands at, a question mark as one, how much of a checklist is ticked, and the roads lost', () => {
    expect(standing(abbot)).toBe('stands at "The abbot at the gate"');
    expect(standing(onTheLight)).toBe(
      'stands at "A light on the water", 1 of 2 ticked; lost "A gift to the mission"',
    );
    expect(standing({ ...abbot, ending: { kind: 'completed' } })).toBe('finished');
  });

  it('says the first list whole, and after it only what was offered or moved on', () => {
    expect(whatChangedIn(null, [])).toEqual(['no quests yet']);
    expect(whatChangedIn([], [abbot])).toEqual([
      '"The abbot of the isle" offered: stands at "The abbot at the gate"',
    ]);
    expect(whatChangedIn([abbot], [abbot])).toEqual([]);
    expect(whatChangedIn([abbot], [onTheLight])).toHaveLength(1);
  });
});

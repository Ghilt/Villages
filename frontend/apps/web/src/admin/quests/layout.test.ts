import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseQuest } from '@villages/world';

import { layOutQuest } from './layout';

const abbot = parseQuest(
  readFileSync(new URL('../../../../../../world/catalogues/quests/abbot.json', import.meta.url), 'utf8'),
);

describe('a quest as its road', () => {
  const { placed, roads } = layOutQuest(abbot);
  const at = (id: string) => placed.find((node) => node.id === id)!;

  it('leads from the gate down each road by the ending that takes it, and both roads join', () => {
    expect(roads.filter((road) => road.from === 'gate')).toEqual([
      { from: 'gate', to: 'gift', endings: ['pleased'] },
      { from: 'gate', to: 'light', endings: ['doubts'] },
    ]);
    expect(roads.filter((road) => road.to === 'consecration').map((road) => road.from)).toEqual([
      'gift',
      'light',
    ]);
  });

  it('stands a node above what it leads to, and the two roads side by side', () => {
    expect(at('gate').y).toBeLessThan(at('gift').y);
    expect(at('gift').y).toBe(at('light').y);
    expect(at('gift').x).not.toBe(at('light').x);
    expect(at('consecration').y).toBeLessThan(at('blessing').y);
  });
});

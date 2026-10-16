import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseDialogue } from '@villages/world';

import { layOutDialogue } from './layout';

const letter = parseDialogue(
  readFileSync(new URL('../../../../../../world/catalogues/dialogues/letter.json', import.meta.url), 'utf8'),
);

describe('a dialogue as a tree', () => {
  const { placed, leads } = layOutDialogue(letter);
  const at = (id: string) => placed.find((line) => line.id === id)!;

  it('leads from each line to the next, and from a choice to each option', () => {
    expect(leads.filter((lead) => lead.from === 'reads')).toEqual([
      { from: 'reads', to: 'accept', option: true },
      { from: 'reads', to: 'ask', option: true },
      { from: 'reads', to: 'refuse', option: true },
    ]);
    expect(leads).toContainEqual({ from: 'arrives', to: 'reads', option: false });
    expect(leads.some((lead) => lead.from === 'shrugs')).toBe(false);
  });

  it('stands a line above what it leads to, and the options of a choice side by side', () => {
    expect(at('arrives').y).toBeLessThan(at('reads').y);
    expect(at('reads').y).toBeLessThan(at('accept').y);
    expect(at('accept').y).toBe(at('ask').y);
    expect(at('accept').x).not.toBe(at('ask').x);
  });
});

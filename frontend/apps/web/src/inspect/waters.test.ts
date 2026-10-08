import { describe, expect, it } from 'vitest';

import type { InspectedAtFrame } from '@villages/protocol';

import { describeWater } from './describe';
import { paneIdOf, subjectOfPane } from './subjects';
import { called, heardWater, sayAnswer, watersStore } from './waters';

const at = { lat: 52.25, lon: 21 };
const vistula: InspectedAtFrame = {
  type: 'inspectedAt',
  at,
  revealed: true,
  water: { kind: 'river', id: 'Q548', name: 'Vistula', also: 'Wisła', of1790: false },
};
const tagus: InspectedAtFrame = {
  type: 'inspectedAt',
  at: { lat: 39.46, lon: -8.2 },
  revealed: true,
  water: {
    kind: 'river',
    id: 'ne_10m_rivers_lake_centerlines:51:Tajo',
    name: 'Tagus',
    also: 'Tajo',
    of1790: true,
  },
};
const northSea: InspectedAtFrame = {
  type: 'inspectedAt',
  at: { lat: 55.5, lon: 3 },
  revealed: true,
  water: { kind: 'sea', id: 'Q1693', name: 'German Ocean', also: 'North Sea', of1790: true },
};

describe('water the server named for a click', () => {
  it('is kept under its real identity, so two clicks on it are one window', () => {
    expect(heardWater(vistula)?.id).toBe('Q548');
    expect(heardWater({ ...vistula, at: { lat: 53, lon: 19 } })?.id).toBe('Q548');
    expect(watersStore.get().seen.get('Q548')?.at).toEqual({ lat: 53, lon: 19 });
  });

  it('is kept under the place it was clicked where nobody has named it, and an answer with none keeps nothing', () => {
    expect(heardWater({ ...vistula, water: { kind: 'lake', of1790: false } })?.id).toBe('at:52.250,21.000');
    expect(heardWater({ ...vistula, water: null })).toBeNull();
    expect(heardWater({ ...vistula, revealed: false, water: null })).toBeNull();
  });

  it('is said in the log by kind and name, or why there is none', () => {
    expect(sayAnswer(vistula)).toBe('52.25°N 21.00°E: river, the Vistula (Wisła)');
    expect(sayAnswer(tagus)).toBe('39.46°N 8.20°W: river, the Tagus (Tajo today)');
    expect(sayAnswer(northSea)).toBe('55.50°N 3.00°E: sea, the German Ocean (North Sea today)');
    expect(sayAnswer({ ...vistula, water: { kind: 'lake', of1790: false } })).toBe(
      '52.25°N 21.00°E: a lake nobody has named',
    );
    expect(sayAnswer({ ...vistula, water: null })).toBe('52.25°N 21.00°E: no water there');
    expect(sayAnswer({ ...vistula, revealed: false, water: null })).toBe(
      '52.25°N 21.00°E: under the fog, so the server names nothing',
    );
  });

  it('is called as English says it in a sentence: the river and the sea, a lake as its name has it', () => {
    expect(called('river', 'Vistula')).toBe('the Vistula');
    expect(called('sea', 'German Ocean')).toBe('the German Ocean');
    expect(called('sea', 'The Sleeve')).toBe('the Sleeve');
    expect(called('lake', 'Lake Maeler')).toBe('Lake Maeler');
    expect(called('lake', 'Loch Ness')).toBe('Loch Ness');
    expect(called('lake', 'Lake of Geneva')).toBe('the Lake of Geneva');
    expect(called('lake', 'Zuyder Zee')).toBe('the Zuyder Zee');
  });

  it('is a window saying its kind and name, today’s under a name of 1790, what is said of it, and a way back', () => {
    expect(describeWater(heardWater(tagus)!)).toEqual({
      kind: 'River',
      name: 'Tagus',
      under: 'Tajo today',
      facts: [],
      links: [{ what: 'show it on the map', to: 'map', at: { lat: 39.46, lon: -8.2 } }],
    });
    expect(describeWater(heardWater(northSea)!)).toMatchObject({
      kind: 'Sea',
      name: 'German Ocean',
      under: 'North Sea today',
    });
    const told = { ...northSea, water: { ...northSea.water!, about: 'The herring sea of the Dutch.' } };
    expect(describeWater(heardWater(told)!).about).toBe('The herring sea of the Dutch.');
    const nameless = describeWater(heardWater({ ...vistula, water: { kind: 'lake', of1790: false } })!);
    expect(nameless).toMatchObject({ kind: 'Lake', name: 'A lake', under: 'no name has reached you' });
  });

  it('is a pane whose id holds the colons of its real identity, and comes back whole', () => {
    const subject = { kind: 'river', id: 'ne_10m_rivers_lake_centerlines:51:Tajo' } as const;
    expect(subjectOfPane(paneIdOf(subject))).toEqual(subject);
    expect(subjectOfPane(paneIdOf({ kind: 'sea', id: 'Q1693' }))).toEqual({ kind: 'sea', id: 'Q1693' });
    expect(subjectOfPane('inspect:house:6d5b0a2e')).toEqual({ kind: 'house', id: '6d5b0a2e' });
    expect(subjectOfPane('inspect:river')).toBeNull();
    expect(subjectOfPane('inspect:pond:Q1')).toBeNull();
  });
});

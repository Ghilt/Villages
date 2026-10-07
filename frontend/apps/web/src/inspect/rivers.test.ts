import { describe, expect, it } from 'vitest';

import type { InspectedFrame } from '@villages/protocol';

import { describeRiver } from './describe';
import { heardRiver, riversStore, sayAnswer } from './rivers';
import { paneIdOf, subjectOfPane } from './subjects';

const at = { lat: 52.25, lon: 21 };
const vistula: InspectedFrame = {
  type: 'inspected',
  at,
  revealed: true,
  river: { id: 'Q548', name: 'Vistula', also: 'Wisła', of1790: false },
};
const tagus: InspectedFrame = {
  type: 'inspected',
  at: { lat: 39.46, lon: -8.2 },
  revealed: true,
  river: { id: 'ne_10m_rivers_lake_centerlines:51:Tajo', name: 'Tagus', also: 'Tajo', of1790: true },
};

describe('a river the server named for a click', () => {
  it('is kept under its real identity, so two clicks on it are one window', () => {
    expect(heardRiver(vistula)?.id).toBe('Q548');
    expect(heardRiver({ ...vistula, at: { lat: 53, lon: 19 } })?.id).toBe('Q548');
    expect(riversStore.get().seen.get('Q548')?.at).toEqual({ lat: 53, lon: 19 });
  });

  it('is kept under the place it was clicked where nobody has named it, and an answer with none keeps nothing', () => {
    expect(heardRiver({ ...vistula, river: { of1790: false } })?.id).toBe('at:52.250,21.000');
    expect(heardRiver({ ...vistula, river: null })).toBeNull();
    expect(heardRiver({ ...vistula, revealed: false, river: null })).toBeNull();
  });

  it('is said in the log by name, or why there is none', () => {
    expect(sayAnswer(vistula)).toBe('52.25°N 21.00°E: the Vistula (Wisła)');
    expect(sayAnswer(tagus)).toBe('39.46°N 8.20°W: the Tagus (Tajo today)');
    expect(sayAnswer({ ...vistula, river: { of1790: false } })).toBe(
      '52.25°N 21.00°E: a river nobody has named',
    );
    expect(sayAnswer({ ...vistula, river: null })).toBe('52.25°N 21.00°E: no river there');
    expect(sayAnswer({ ...vistula, revealed: false, river: null })).toBe(
      '52.25°N 21.00°E: under the fog, so the server names nothing',
    );
  });

  it('is a window saying its name, today’s under a name of 1790, and a way back to where it was clicked', () => {
    const seen = heardRiver(tagus)!;
    expect(describeRiver(seen)).toEqual({
      kind: 'River',
      name: 'Tagus',
      under: 'Tajo today',
      facts: [],
      links: [{ what: 'show it on the map', to: 'map', at: { lat: 39.46, lon: -8.2 } }],
    });
    expect(describeRiver(heardRiver({ ...vistula, river: { of1790: false } })!).name).toBe('A river');
  });

  it('is a pane whose id holds the colons of its real identity, and comes back whole', () => {
    const subject = { kind: 'river', id: 'ne_10m_rivers_lake_centerlines:51:Tajo' } as const;
    expect(subjectOfPane(paneIdOf(subject))).toEqual(subject);
    expect(subjectOfPane('inspect:house:6d5b0a2e')).toEqual({ kind: 'house', id: '6d5b0a2e' });
    expect(subjectOfPane('inspect:river')).toBeNull();
  });
});

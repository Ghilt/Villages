import { describe, expect, it } from 'vitest';

import type { WorldName } from './names.ts';
import { SettlementNamer, asPlace } from './settlementNames.ts';
import type { RegionSquares } from './settlementNames.ts';

const named = (one: Partial<WorldName> & Pick<WorldName, 'id' | 'kind' | 'name'>): WorldName => ({
  form: 'today',
  at: [0, 0],
  earth: [0, 0],
  lines: [],
  ...one,
});

const names: WorldName[] = [
  named({ id: 'Q90', kind: 'town', name: 'Paris', form: '1790', at: [2.35, 48.85] }),
  named({
    id: 'Q1471',
    kind: 'river',
    name: 'Seine',
    lines: [
      [
        [1.0, 49.0],
        [3.0, 48.6],
      ],
    ],
  }),
  named({
    id: 'Q6403',
    kind: 'lake',
    name: 'Lake of Geneva',
    at: [6.5, 46.45],
    lines: [
      [
        [6.2, 46.35],
        [6.9, 46.35],
        [6.9, 46.55],
        [6.2, 46.55],
        [6.2, 46.35],
      ],
    ],
  }),
  named({
    id: 'Q1',
    kind: 'lake',
    name: 'Lake Eğirdir',
    at: [30.85, 38.05],
    lines: [
      [
        [30.8, 38.0],
        [30.9, 38.0],
        [30.9, 38.1],
        [30.8, 38.1],
        [30.8, 38.0],
      ],
    ],
  }),
];

/** Four squares across and two down: the north-west is in Bohemia by the German Ocean, the south-east on Lanzarote. */
function squares(): RegionSquares {
  const bytes = new Uint8Array(4 * 2 * 2 * 2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 1, true);
  view.setUint16((8 + 0) * 2, 2, true);
  view.setUint16(7 * 2, 3, true);
  return {
    columns: 4,
    rows: 2,
    bytes,
    regions: [
      { name: 'Bohemia', kind: 'land', feature: 'Geoarea' },
      { name: 'German Ocean', kind: 'sea' },
      { name: 'Lanzarote Island', kind: 'land', feature: 'Island' },
    ],
  };
}

const namer = new SettlementNamer(names, squares());

describe("a settlement's name", () => {
  it('is by the ruins of the town it stands beside', () => {
    expect(namer.nameOf({ type: 'village', by: 'Q90', first: true, lng: 2.6, lat: 48.9 }, 'village')).toBe(
      'village by the ruins of Paris',
    );
  });

  it("is by the water about it for a ruin's other villages, and by the ruins where nothing has a name", () => {
    expect(namer.nameOf({ type: 'village', by: 'Q90', first: false, lng: 2.0, lat: 48.85 }, 'village')).toBe(
      'village by the Seine',
    );
    expect(namer.nameOf({ type: 'village', by: 'Q90', first: false, lng: 100, lat: 10 }, 'village')).toBe(
      'village by the ruins of Paris',
    );
  });

  it('is on the lake a fishing village fishes, inside it or beside it', () => {
    expect(
      namer.nameOf(
        { type: 'fishingVillage', by: null, first: false, lng: 6.5, lat: 46.6 },
        'fishing village',
      ),
    ).toBe('fishing village on the Lake of Geneva');
    expect(
      namer.nameOf(
        { type: 'fishingVillage', by: null, first: false, lng: 30.85, lat: 38.05 },
        'fishing village',
      ),
    ).toBe('fishing village on Lake Eğirdir');
  });

  it('is on the sea where no lake is near, by its square', () => {
    expect(
      namer.nameOf({ type: 'fishingVillage', by: null, first: false, lng: -170, lat: 80 }, 'fishing village'),
    ).toBe('fishing village on the German Ocean');
  });

  it('is by the river a village stands near, and else in the land it stands in, or on its island', () => {
    expect(namer.nameOf({ type: 'village', by: null, first: false, lng: 2.0, lat: 48.85 }, 'village')).toBe(
      'village by the Seine',
    );
    expect(namer.nameOf({ type: 'village', by: null, first: false, lng: -170, lat: 80 }, 'village')).toBe(
      'village in Bohemia',
    );
    expect(namer.nameOf({ type: 'village', by: null, first: false, lng: 170, lat: -80 }, 'village')).toBe(
      'village on Lanzarote Island',
    );
    expect(namer.nameOf({ type: 'village', by: null, first: false, lng: 100, lat: 10 }, 'village')).toBe(
      'village',
    );
  });

  it('says a name as a sentence after by or on would', () => {
    expect(asPlace('Loire')).toBe('the Loire');
    expect(asPlace('Lake of Geneva')).toBe('the Lake of Geneva');
    expect(asPlace('Lake Eğirdir')).toBe('Lake Eğirdir');
    expect(asPlace('the Archipelago')).toBe('the Archipelago');
    expect(asPlace("Hudson's Bay", 'bay')).toBe("Hudson's Bay");
    expect(asPlace('James Bay', 'bay')).toBe('James Bay');
    expect(asPlace('Bay of Bengal', 'bay')).toBe('the Bay of Bengal');
    expect(asPlace('Andes', 'Range/mtn')).toBe('the Andes');
    expect(asPlace('Normandy', 'Geoarea')).toBe('Normandy');
    expect(asPlace('Bijagós Islands', 'Island group')).toBe('the Bijagós Islands');
  });
});

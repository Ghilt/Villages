import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { WorldName } from './names.ts';
import { fileNames } from './namesFile.ts';
import type { EarthRegion } from './regions.ts';

/** The names as the page and the game server read them, shared with the Kotlin side. See decision record 0085. */
const fixture = JSON.parse(
  readFileSync(new URL('../../../../contracts/fixtures/names.json', import.meta.url), 'utf8'),
) as { file: unknown; regions: string };

// The fixture's world, four squares across and two down: a town of 1790, a river and a peak carried somewhere
// else, the north-east quarter's land in Pomerania and both northern quarters east of the meridian by the
// Baltic, and a sea that was given no square at all. Written out as the types say, so that a field renamed in
// them is a field renamed here, and the fixture has to follow.
const names: WorldName[] = [
  {
    id: 'Q1792',
    kind: 'town',
    name: 'Dantzic',
    also: 'Gdańsk',
    rank: 4,
    from: 4.5,
    form: '1790',
    at: [18.64, 54.36],
    earth: [18.64, 54.36],
    lines: [],
  },
  {
    id: 'ne_10m_rivers_lake_centerlines:166:Vistula',
    kind: 'river',
    name: 'Vistula',
    also: 'Wisła',
    rank: 5,
    from: 5.7,
    form: 'today',
    at: [19.1, 53.5],
    earth: [19.1, 53.5],
    lines: [
      [
        [18.95, 54.35],
        [19.1, 53.5],
        [21.9, 51.48],
      ],
    ],
  },
  {
    id: 'Q583',
    kind: 'peak',
    name: 'Mont Blanc',
    elevation: 4808,
    rank: 1,
    from: 3,
    form: 'today',
    at: [-6.87, -45.83],
    earth: [6.87, 45.83],
    lines: [],
  },
];
const list: EarthRegion[] = [
  { id: 'Q545', kind: 'sea', name: 'Baltic Sea', feature: 'sea', rank: 1, from: 2, polygons: [] },
  {
    id: 'ne_10m_geography_regions_polys:41:Pomerania',
    kind: 'land',
    name: 'Pomerania',
    feature: 'Region',
    rank: 4,
    from: 5,
    polygons: [],
  },
  {
    id: 'ne_10m_geography_marine_polys:7:Sea of Azov',
    kind: 'sea',
    name: 'Sea of Azov',
    feature: 'sea',
    polygons: [],
  },
];
const given = {
  land: Uint16Array.from([0, 0, 2, 0, 0, 0, 0, 0]),
  sea: Uint16Array.from([0, 0, 1, 1, 0, 0, 0, 0]),
};
const labels = [{ at: [90, 45] as const, squares: 2 }, { at: [45, 45] as const, squares: 1 }, null];

describe('the names as they are filed for the page and the game server', () => {
  it('are the shared fixture, field for field and byte for byte', () => {
    const { file, bytes } = fileNames('fixture', names, { list, given, labels }, 4, 2);

    expect(JSON.parse(JSON.stringify(file))).toEqual(fixture.file);
    expect(Buffer.from(bytes!).toString('base64')).toBe(fixture.regions);
  });

  it('count a region only where it was given a square, and file no layers where none were worked out', () => {
    expect(fileNames('fixture', names, { list, given, labels }, 4, 2).file.counts).toMatchObject({
      sea: 1,
      land: 1,
    });

    const { file, bytes } = fileNames('fixture', names, null, 4, 2);
    expect(bytes).toBeNull();
    expect(file.regions).toEqual([]);
    expect(file.counts).toEqual({ river: 1, lake: 0, peak: 1, town: 1, sea: 0, land: 0 });
  });
});

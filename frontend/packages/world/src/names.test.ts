import { describe, expect, it } from 'vitest';

import { carryNames, namesAt } from './names.ts';
import type { Carry, EarthName } from './names.ts';

/** Everything moves ten degrees east, except what lay east of fifty degrees, which was removed. */
const carry: Carry = (lng, lat) => (lng > 50 ? null : [lng + 10, lat]);

const river: EarthName = {
  id: 'Q1',
  kind: 'river',
  name: 'Dnieper',
  also: 'Dnipro',
  lines: [
    [
      [40, 10],
      [45, 10],
      [49, 10],
      [55, 10],
      [58, 10],
      [48, 11],
      [46, 11],
    ],
  ],
};
const lake: EarthName = {
  id: 'Q2',
  kind: 'lake',
  name: 'Ladoga',
  lines: [
    [
      [20, 20],
      [21, 20],
      [21, 21],
      [20, 21],
      [20, 20],
    ],
  ],
};
const halfLake: EarthName = {
  ...lake,
  id: 'Q3',
  lines: [lake.lines[0]!.map(([x, y]) => [x + 30, y] as const)],
};
const peak: EarthName = { id: 'Q4', kind: 'peak', name: 'Elbrus', elevation: 5642, lines: [[[30, 40]]] };
const town: EarthName = { id: 'Q1792', kind: 'town', name: 'Dantzic', also: 'Gdańsk', lines: [[[18, 54]]] };

describe('carrying names into the world', () => {
  const { carried, lost } = carryNames([river, lake, halfLake, peak], carry, 0);

  it('moves each name with its ground, and breaks a river where its ground was removed', () => {
    const dnipro = carried.find((one) => one.id === 'Q1')!;
    expect(dnipro.lines).toEqual([
      [
        [50, 10],
        [55, 10],
        [59, 10],
      ],
      [
        [58, 11],
        [56, 11],
      ],
    ]);
    expect(dnipro.also).toBe('Dnipro');
    expect(carried.find((one) => one.id === 'Q4')!.at).toEqual([40, 40]);
  });

  it('remembers where on Earth each name stood, which carried is where it stands now', () => {
    for (const one of carried) {
      expect(carry(...one.earth)).toEqual(one.at);
      expect(one.form).toBe('today');
    }
    expect(carried.find((one) => one.id === 'Q4')!.earth).toEqual([30, 40]);
  });

  it('keeps a lake whole or not at all', () => {
    expect(carried.find((one) => one.id === 'Q2')!.lines[0]).toHaveLength(5);
    expect(carried.some((one) => one.id === 'Q3')).toBe(false);
    expect(lost).toBe(1);
  });

  it('breaks a river where two points beside each other on Earth land far apart', () => {
    const torn: Carry = (lng, lat) => [lng < 45 ? lng : lng + 20, lat];
    const carriedTorn = carryNames(
      [
        {
          ...river,
          lines: [
            [
              [40, 0],
              [44, 0],
              [46, 0],
              [48, 0],
            ],
          ],
        },
      ],
      torn,
      0,
    ).carried[0]!;
    expect(carriedTorn.lines).toHaveLength(2);
  });
});

describe('what is named at a place', () => {
  const { carried } = carryNames([river, lake, peak, town], carry, 0);

  it('names the river a place is by, the lake it is in and the peak it is near', () => {
    expect(namesAt(carried, 54, 10.02).river?.name).toBe('Dnieper');
    expect(namesAt(carried, 30.5, 20.5).lake?.name).toBe('Ladoga');
    expect(namesAt(carried, 40.1, 40.1).peak?.name).toBe('Elbrus');
  });

  it('names the town a place is near, with what it is called today', () => {
    const near = namesAt(carried, 28.1, 54.1).town;
    expect([near?.name, near?.also]).toEqual(['Dantzic', 'Gdańsk']);
    expect(namesAt(carried, 28.5, 54).town).toBeUndefined();
  });

  it('names nothing far from all of them', () => {
    expect(namesAt(carried, 0, 0)).toEqual({});
    expect(namesAt(carried, 54, 10.2).river).toBeUndefined();
  });
});

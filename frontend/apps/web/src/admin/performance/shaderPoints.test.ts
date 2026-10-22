import { describe, expect, it } from 'vitest';

import { FAMILIES, alike, byFamily, familyOf, lineOf, pointName, readShaderPoints } from './shaderPoints';
import type { Point } from './shaderPoints';

const point = (commit: string, at: string, gpu = 'NVIDIA GeForce RTX 3070', method = 1): Point => ({
  method,
  why: 'history',
  measuredAt: '2026-10-20T08:00:00.000Z',
  code: { commit, subject: `the ${commit} commit`, landedAt: at, dirty: false },
  machine: { gpu, driver: '610.88', chrome: '155', viewport: '1920x1080', dpr: 1 },
  master: 'terrain3_mended_2026-10-03',
  levels: { applied: {}, defaults: {} },
  places: [],
  fogMissed: null,
});

describe('the shaders’ points', () => {
  it('reads a point a line, and counts the lines that are not points', () => {
    const text = [
      JSON.stringify(point('aaaaaaa1', '2026-10-03T10:00:00+02:00')),
      'not json',
      '{"method":1}',
      '',
    ].join('\n');
    const { points, unreadable } = readShaderPoints(text);
    expect(points.map((each) => each.code.commit)).toEqual(['aaaaaaa1']);
    expect(unreadable).toBe(2);
  });

  it('draws as one line only the points measured as the latest was, in the order their code was the game’s', () => {
    const points = [
      point('bbbbbbb2', '2026-10-10T10:00:00+02:00'),
      point('ccccccc3', '2026-10-05T10:00:00+02:00', 'another card'),
      point('aaaaaaa1', '2026-10-03T10:00:00+02:00'),
    ];
    expect(lineOf(points).map((each) => each.code.commit)).toEqual(['aaaaaaa1', 'bbbbbbb2']);
    expect(alike(points[0]!, points[1]!)).toBe(false);
    expect(alike(points[0]!, { ...points[0]!, method: 2 })).toBe(false);
    expect(pointName(points[0]!)).toBe('bbbbbbb 10-10');
  });

  it('puts every thing that drew in a family, the grass of before the land’s', () => {
    expect(familyOf('sprites:land')).toBe('land');
    expect(familyOf('sprites:grass')).toBe('land');
    expect(familyOf('sprites:land-grass')).toBe('land');
    expect(familyOf('sprites:land-ice-salt-sand')).toBe('land');
    expect(familyOf('map:water')).toBe('water');
    expect(familyOf('map:water-ripple-core')).toBe('water');
    expect(familyOf('sprites:clouds')).toBe('clouds');
    expect(familyOf('sprites:fog-of-war-uncolour')).toBe('fog');
    expect(familyOf('sprites:scenery-shadows')).toBe('scenery');
    expect(familyOf('map:relief-ours')).toBe('relief');
    expect(familyOf('map:painterly')).toBe('map');
    expect(familyOf('sprites:clear')).toBe('clears');
    expect(familyOf('sprites:batch')).toBe('sprites');
    expect(familyOf('sprites:program#1a2b3c')).toBe('sprites');
  });

  it('gathers a place’s milliseconds by family, every family there', () => {
    const gathered = byFamily({
      'sprites:land': 3,
      'map:water': 0.5,
      'map:water-ripple-halo': 0.1,
      'map:sea': 0.2,
    });
    expect(gathered.land).toBe(3);
    expect(gathered.water).toBeCloseTo(0.6);
    expect(gathered.map).toBeCloseTo(0.2);
    expect(Object.keys(gathered)).toEqual(FAMILIES.map((family) => family.name));
  });
});

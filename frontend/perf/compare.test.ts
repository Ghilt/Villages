import { describe, expect, it } from 'vitest';

import { besideSaid, measureOf, said, whatMoved } from './compare';
import { keptPlace, lastLike, pointsIn } from './kept';
import type { KeptPlace, Point } from './kept';

const place = (name: string, frame: number, keys: Record<string, number>): KeptPlace => ({
  name,
  lat: 0,
  lon: 0,
  zoom: 10,
  frame,
  p50: frame,
  p80: frame,
  cpu: 0.5,
  keys,
  draws: {},
  settled: true,
});

describe('what moved', () => {
  it('calls a change under ten in a hundred, 0.1 ms a frame or 0.05 ms a part, nothing', () => {
    const then = [place('bog', 3.76, { 'sprites:land': 3.49 }), place('sky', 1, { 'sprites:clouds': 0.83 })];
    const now = [
      place('bog', 3.85, { 'sprites:land': 3.58 }),
      place('sky', 1.04, { 'sprites:clouds': 0.87 }),
    ];
    const comparison = whatMoved(now, then);
    expect(comparison.moved).toEqual([]);
    expect(comparison.held).toEqual(['bog', 'sky']);
    expect(said(comparison)).toEqual([
      'nothing moved beyond 10%, 0.1 ms a frame or 0.05 ms a part, at 2 places',
    ]);
  });

  it('names a place whose part moved, though its frame did not', () => {
    const then = [place('grassland', 4.31, { 'sprites:land': 4.06, 'sprites:scenery': 0.02 })];
    const now = [place('grassland', 4.36, { 'sprites:land': 3.81, 'sprites:scenery': 0.3 })];
    // The land's 0.25 ms is under ten in a hundred of its 4.06: only the scenery moved.
    expect(whatMoved(now, then).moved.map((move) => move.parts.map((part) => part.key))).toEqual([
      ['sprites:scenery'],
    ]);
  });

  it('names a place that moved, and the parts that moved within it', () => {
    const then = [place('coast', 2.3, { 'sprites:land': 1.52, 'map:water': 0.59 })];
    const now = [place('coast', 1.75, { 'sprites:land': 1.52, 'map:water': 0.04 })];
    const comparison = whatMoved(now, then);
    expect(comparison.moved).toEqual([
      { place: 'coast', then: 2.3, now: 1.75, parts: [{ key: 'map:water', then: 0.59, now: 0.04 }] },
    ]);
    expect(said(comparison)).toEqual(['coast 2.30 → 1.75 ms (-24%): map:water 0.59 → 0.04']);
  });

  it('compares the fog by its own parts, the ground round the seat being another each run', () => {
    const fog = (frame: number, own: number) =>
      place('fog', frame, { 'sprites:land': frame - own, 'sprites:fog-of-war': own });
    expect(measureOf(fog(2.47, 0.07))).toBeCloseTo(0.07);
    expect(whatMoved([fog(4.1, 0.07)], [fog(2.47, 0.07)]).moved).toEqual([]);
  });

  it('says which places were measured only once', () => {
    const comparison = whatMoved([place('sky', 1, {})], [place('fog', 2, {})]);
    expect(comparison.added).toEqual(['sky']);
    expect(comparison.gone).toEqual(['fog']);
  });
});

describe('a point kept', () => {
  it('keeps the parts that cost something, to the microsecond', () => {
    const kept = keptPlace({
      name: 'bog',
      lat: 67.70941234,
      lon: 81.2988,
      zoom: 10,
      settled: true,
      draws: { 'sprites:land': 1, 'map:painterly': 12.4 },
      reading: {
        frame: 3.7612345,
        p50: 4.5,
        p80: 4.55,
        cpu: 0.7,
        keys: { 'sprites:land': 3.4912, 'map:clear': 0.001 },
      },
    });
    expect(kept.frame).toBe(3.761);
    expect(kept.lat).toBe(67.709);
    expect(kept.keys).toEqual({ 'sprites:land': 3.491 });
    expect(Object.keys(kept.draws)).toEqual(['map:painterly', 'sprites:land']);
  });

  it('reads the points of a file and finds the last measured alike', () => {
    const point = (gpu: string, method: number) =>
      JSON.stringify({ method, machine: { gpu, viewport: '1920x1080' }, places: [], code: { commit: gpu } });
    const points = pointsIn(
      [point('RTX 3070', 1), 'not a point', point('RTX 3070', 2), point('other', 1), ''].join('\n'),
    );
    expect(points).toHaveLength(3);
    const like = { method: 1, machine: { gpu: 'RTX 3070', viewport: '1920x1080' } } as Pick<
      Point,
      'method' | 'machine'
    >;
    expect(lastLike(points, like)?.method).toBe(1);
    expect(lastLike(points, { ...like, method: 3 })).toBeNull();
  });

  it('puts a start or a zoom beside the last point, and says moved only beyond a fifth and the least amount', () => {
    const lines = besideSaid([
      { name: 'again: ready', then: 3300, now: 4500, least: 300, unit: 's' },
      { name: 'again: long tasks', then: 100, now: 180, least: 150, unit: 'ms' },
      { name: 'built: ready', then: null, now: 1500, least: 300, unit: 's' },
    ]);
    expect(lines[0]).toMatch(/^moved again: ready\s+3\.3 →\s+4\.5 s$/);
    expect(lines[1]).toMatch(/^\s+again: long tasks\s+100 →\s+180 ms$/);
    expect(lines[2]).toMatch(/^\s+built: ready\s+- →\s+1\.5 s$/);
  });

  it('compares with the point of the newest code main held, whatever order the points were kept in', () => {
    const point = (commit: string, landedAt: string | null) =>
      JSON.stringify({
        method: 1,
        machine: { gpu: 'RTX 3070', viewport: '1920x1080' },
        places: [],
        code: { commit, landedAt },
      });
    const like = { method: 1, machine: { gpu: 'RTX 3070', viewport: '1920x1080' } } as Pick<
      Point,
      'method' | 'machine'
    >;
    const kept = [
      point('tip', '2026-10-19T21:55:59+02:00'),
      point('older', '2026-10-04T11:54:00+02:00'),
      point('by hand', null),
    ];
    expect(lastLike(pointsIn(kept.join('\n')), like)?.code.commit).toBe('tip');
    expect(lastLike(pointsIn(kept[2]!), like)?.code.commit).toBe('by hand');
  });
});

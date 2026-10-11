import { describe, expect, it } from 'vitest';

import { CULTURE_NONE, cultureAt, culturesOf, nearestCulture, parseCultureAnchors } from './culture.ts';
import type { CultureAnchor } from './culture.ts';
import { ORIGIN_EARTH, ORIGIN_INVENTED, ORIGIN_SEA } from './originFile.ts';
import type { OriginGrid } from './originFile.ts';

const ANCHORS: CultureAnchor[] = [
  { name: 'Paris', lat: 48.86, lon: 2.35, culture: 'european' },
  { name: 'Cairo', lat: 30.04, lon: 31.24, culture: 'islamic' },
  { name: 'Edo', lat: 35.68, lon: 139.69, culture: 'eastAsian' },
];

/** A world four squares across and two down, a master pixel a square, each square said where it came from. */
function grid(squares: readonly { status: number; lat?: number; lon?: number }[]): OriginGrid {
  const n = squares.length;
  const zeros = () => new Float32Array(n);
  const x = zeros();
  const y = zeros();
  squares.forEach((one, k) => {
    x[k] = (((one.lon ?? 0) + 180) / 360) * 4;
    y[k] = ((90 - (one.lat ?? 0)) / 180) * 2;
  });
  return {
    cell: 1,
    columns: 4,
    rows: 2,
    x,
    y,
    a: zeros(),
    b: zeros(),
    c: zeros(),
    d: zeros(),
    agreement: zeros(),
    status: Uint8Array.from(squares.map((one) => one.status)),
  };
}

describe('the culture map', () => {
  it('reads the anchors, and refuses one with a culture there is none of', () => {
    expect(parseCultureAnchors(JSON.stringify({ anchors: ANCHORS }))).toHaveLength(3);
    expect(() =>
      parseCultureAnchors(
        JSON.stringify({ anchors: [{ name: 'Atlantis', lat: 0, lon: 0, culture: 'atlantean' }] }),
      ),
    ).toThrow(/anchor 0/);
  });

  it('gives a place on Earth the culture of the nearest anchor, round the sphere', () => {
    expect(nearestCulture(ANCHORS, 41.9, 12.5)).toBe('european');
    expect(nearestCulture(ANCHORS, 33.3, 44.4)).toBe('islamic');
    expect(nearestCulture(ANCHORS, 37.5, 127)).toBe('eastAsian');
    // Across the date line from Edo, not the long way round to Paris.
    expect(nearestCulture(ANCHORS, 40, -170)).toBe('eastAsian');
  });

  it("gives Earth's land its anchor's culture, invented land the nearest Earth's, and sea none", () => {
    const origin = grid([
      { status: ORIGIN_EARTH, lat: 30, lon: 31 },
      { status: ORIGIN_INVENTED },
      { status: ORIGIN_INVENTED },
      { status: ORIGIN_SEA },
      { status: ORIGIN_SEA },
      { status: ORIGIN_SEA },
      { status: ORIGIN_EARTH, lat: 48, lon: 2 },
      { status: ORIGIN_SEA },
    ]);

    const cultures = culturesOf(origin, 4, 2, ANCHORS);

    expect([...cultures]).toEqual([1, 1, 0, CULTURE_NONE, CULTURE_NONE, CULTURE_NONE, 0, CULTURE_NONE]);
    const file = { cell: 1, columns: 4, rows: 2, width: 4, height: 2 };
    expect(cultureAt(file, cultures, -170, 45)).toBe('islamic');
    expect(cultureAt(file, cultures, 100, -45)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { fillOf, fittedHeight } from './heightFitted.ts';
import { ORIGIN_CLONE, ORIGIN_EARTH, ORIGIN_INVENTED, ORIGIN_SEA } from './originFile.ts';
import type { OriginGrid } from './originFile.ts';

/** A world of four squares by two, each 90 degrees: 360 pixels by 180, so a pixel is a degree. */
const SIZE = { width: 360, height: 180 };
const CELL = 90;

/** Earth rising a metre a degree eastward from 1000 m at the antimeridian, sea west of 170 W. */
const earth = (lon: number) => (lon < -170 ? -50 : 1000 + (lon + 180));

/** An origin grid where every square is `kind`, each placed where it is, with the given changes. */
function originOf(
  kinds: number[],
  placed: Record<number, Partial<{ x: number; y: number; a: number; b: number; c: number; d: number }>> = {},
): OriginGrid {
  const n = kinds.length;
  const column = (fill: (k: number) => number) => Float32Array.from({ length: n }, (_, k) => fill(k));
  const middle = (k: number) => [(k % 4) * CELL + CELL / 2, Math.floor(k / 4) * CELL + CELL / 2] as const;
  return {
    cell: CELL,
    columns: 4,
    rows: 2,
    x: column((k) => placed[k]?.x ?? middle(k)[0]),
    y: column((k) => placed[k]?.y ?? middle(k)[1]),
    a: column((k) => placed[k]?.a ?? 1),
    b: column((k) => placed[k]?.b ?? 0),
    c: column((k) => placed[k]?.c ?? 0),
    d: column((k) => placed[k]?.d ?? 1),
    agreement: column(() => 1),
    status: Uint8Array.from(kinds),
  };
}

const E = ORIGIN_EARTH;
const S = ORIGIN_SEA;
const I = ORIGIN_INVENTED;

describe('the master’s own height, read through the origin map', () => {
  it('is Earth’s where the land never moved, and nought at sea and where Earth is sea', () => {
    const origin = originOf([E, E, E, S, E, E, E, E]);
    const at = fittedHeight(origin, SIZE, fillOf(origin, SIZE, earth), earth);
    expect(at(-100, 40)).toBeCloseTo(1080);
    expect(at(10, 40)).toBeCloseTo(1190);
    expect(at(120, 40)).toBe(0);
    expect(at(-175, -40)).toBe(0);
  });

  it('is the height of where a square was cut from, so moved land takes its height with it', () => {
    // The square at 0 to 90 east came from 90 to 180 west: 90 degrees of Earth further west.
    const origin = originOf([E, E, E, E, E, E, E, E], { 2: { x: 2 * CELL + CELL / 2 - 180 } });
    const at = fittedHeight(origin, SIZE, fillOf(origin, SIZE, earth), earth);
    expect(at(45, 40)).toBeCloseTo(1045);
    expect(at(45, -40)).toBeCloseTo(1225);
  });

  it('carries a turned or mirrored square by its matrix, and reads a copy as it reads Earth', () => {
    // Mirrored east to west about its middle: its east edge reads Earth's west edge.
    const origin = originOf([E, E, ORIGIN_CLONE, E, E, E, E, E], { 2: { a: -1 } });
    const at = fittedHeight(origin, SIZE, fillOf(origin, SIZE, earth), earth);
    expect(at(80, 40)).toBeCloseTo(1000 + 180 + 10);
    expect(at(10, 40)).toBeCloseTo(1000 + 180 + 80);
  });

  it('gives invented land a height between its neighbours’, never a cliff down to nought', () => {
    const origin = originOf([E, I, E, E, E, E, E, E]);
    const square = fillOf(origin, SIZE, earth, 1).heights[1]!;
    expect(square).toBeGreaterThan(1000);
    expect(square).toBeLessThan(1225);
    const at = fittedHeight(origin, SIZE, fillOf(origin, SIZE, earth, 1), earth);
    expect(at(-45, 40)).toBeCloseTo(square, 0);
    expect(at(-89, 40)).toBeGreaterThan(1000);
  });

  it('fills finer than a square, so invented land meets each neighbour at the height it has beside it', () => {
    const origin = originOf([E, I, E, E, E, E, E, E]);
    const fill = fillOf(origin, SIZE, earth, 2);
    // The invented square's two cells along its top: the western beside land lower than the eastern's.
    expect(fill.columns).toBe(8);
    expect(fill.heights[2]!).toBeLessThan(fill.heights[3]!);
    expect(fill.heights[2]!).toBeGreaterThan(1000 + 45);
    expect(fill.heights[3]!).toBeLessThan(1000 + 180 + 22.5);
  });

  it('lets an invented island by the sea down towards nought at its coast', () => {
    const origin = originOf([S, S, S, S, I, S, S, S]);
    const fill = fillOf(origin, SIZE, earth);
    expect(Math.max(...fill.heights)).toBe(0);
    expect(fittedHeight(origin, SIZE, fill, earth)(-135, -45)).toBe(0);
  });
});

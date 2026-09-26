import { describe, expect, it } from 'vitest';

import type { FogCircle } from './circles';
import { MOST_TEXELS, REACH, fieldOf } from './fogField';
import type { FogField } from './fogField';

/** The two distances of the texel a point of world space falls in: to revealed ground, and to vision. */
function at(field: FogField, x: number, y: number): { revealed: number; vision: number } {
  const column = Math.floor((x - field.originX) / field.unitsPerTexel);
  const row = Math.floor((y - field.originY) / field.unitsPerTexel);
  if (column < 0 || row < 0 || column >= field.width || row >= field.height) {
    return { revealed: REACH, vision: REACH };
  }
  const index = (row * field.width + column) * 2;
  return { revealed: field.distances[index]!, vision: field.distances[index + 1]! };
}

const seat: FogCircle = { x: 17_000, y: 9_000, radius: 50, lasting: true };

describe('the distance field the fog is drawn from', () => {
  it('is nothing at all for a house with nothing to see from', () => {
    expect(fieldOf([])).toBeNull();
  });

  it('is negative inside a circle, near nought on its edge and as far as it ever says outside', () => {
    const field = fieldOf([seat])!;

    expect(at(field, 17_000, 9_000).revealed).toBeCloseTo(-49.3, 1);
    expect(Math.abs(at(field, 17_050, 9_000).revealed)).toBeLessThan(1);
    expect(at(field, 17_000 + 50 + REACH - 1, 9_000).revealed).toBeGreaterThan(REACH - 2);
    expect(at(field, 16_000, 8_000)).toEqual({ revealed: REACH, vision: REACH });
  });

  it('covers the circles and a reach around them, one texel a world unit', () => {
    const field = fieldOf([seat])!;

    expect(field.originX).toBe(17_000 - 50 - REACH);
    expect(field.originY).toBe(9_000 - 50 - REACH);
    expect(field.unitsPerTexel).toBe(1);
    expect(field.width).toBe(2 * (50 + REACH));
  });

  it('keeps a circle that has ended in revealed ground and out of vision', () => {
    const ended: FogCircle = { x: 17_300, y: 9_000, radius: 50, lasting: false };
    const field = fieldOf([seat, ended])!;

    expect(at(field, 17_300, 9_000).revealed).toBeLessThan(-40);
    expect(at(field, 17_300, 9_000).vision).toBe(REACH);
    expect(at(field, 17_000, 9_000).vision).toBeLessThan(-40);
  });

  it('takes the nearer edge where two circles overlap, so they read as one piece of ground', () => {
    const beside: FogCircle = { x: 17_080, y: 9_000, radius: 50, lasting: true };
    const field = fieldOf([seat, beside])!;

    // Halfway between the two middles, about forty units from each and ten inside both; the texel's
    // middle is half a unit nearer the second, so it is the second's edge that is nearer.
    expect(at(field, 17_040, 9_000).revealed).toBeCloseTo(-10.5, 1);
  });

  it('grows coarser rather than larger when a house sees from both ends of the world', () => {
    const far: FogCircle = { x: 31_000, y: 20_000, radius: 50, lasting: true };
    const field = fieldOf([{ ...seat, x: 1_000 }, far])!;

    expect(field.width).toBeLessThanOrEqual(MOST_TEXELS);
    expect(field.height).toBeLessThanOrEqual(MOST_TEXELS);
    expect(field.unitsPerTexel).toBeGreaterThan(1);
    expect(at(field, 31_000, 20_000).revealed).toBeLessThan(0);
  });
});

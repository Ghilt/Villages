import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  KM_A_UNIT,
  inSquare,
  isASettlement,
  onStreet,
  parseSettlements,
  settlementSquare,
  streetEnds,
  unitsOfKm,
} from './settlements.ts';

const world = readFileSync(new URL('../../../../world/settlements.json', import.meta.url), 'utf8');

describe('the settlements file', () => {
  it("reads the world's own", () => {
    const file = parseSettlements(world);
    expect(file.ground['farmland']).toBe(1);
    expect(file.beside.sites.great).toBeGreaterThan(file.beside.sites.small);
  });

  it('refuses a number it cannot use, naming it', () => {
    const broken = JSON.parse(world) as Record<string, unknown>;
    broken['levels'] = [0.9, 0.8];
    expect(() => parseSettlements(JSON.stringify(broken))).toThrow('world/settlements.json: levels');
    broken['levels'] = [0.8, 0.9];
    broken['grid'] = 12.5;
    expect(() => parseSettlements(JSON.stringify(broken))).toThrow('world/settlements.json: grid');
  });

  it('knows a settlement by its type', () => {
    expect(isASettlement('village')).toBe(true);
    expect(isASettlement('fishingVillage')).toBe(true);
    expect(isASettlement('castle')).toBe(false);
  });
});

describe('a distance on the ground in world units', () => {
  it('is a kilometre to a unit and a fifth at the equator, and twice as many units at sixty degrees', () => {
    expect(unitsOfKm(KM_A_UNIT, 16_384, 32_768)).toBeCloseTo(1, 9);
    const sixty = (0.5 - Math.log(Math.tan(Math.PI / 4 + Math.PI / 6)) / (2 * Math.PI)) * 32_768;
    expect(unitsOfKm(KM_A_UNIT, sixty, 32_768)).toBeCloseTo(2, 6);
  });
});

describe("a settlement's square and its streets", () => {
  const square = settlementSquare(10, 20, 9);

  it('lies round its middle, a side of diamonds each way', () => {
    expect(square).toEqual({ u: 10, v: 20, fromU: 6, fromV: 16, side: 9 });
    expect(inSquare(square, 6, 16)).toBe(true);
    expect(inSquare(square, 14, 24)).toBe(true);
    expect(inSquare(square, 15, 20)).toBe(false);
  });

  it('has two streets through its middle along the lattice, and a road meets each at its ends', () => {
    expect(onStreet(square, 7, 20)).toBe(true);
    expect(onStreet(square, 10, 23)).toBe(true);
    expect(onStreet(square, 7, 21)).toBe(false);
    for (const end of streetEnds(square)) {
      expect(inSquare(square, end.u, end.v)).toBe(false);
      expect(end.u === 10 || end.v === 20).toBe(true);
    }
    expect(streetEnds(square)).toHaveLength(4);
  });
});

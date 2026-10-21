import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { SETTLEMENT_SIDES, settlementIn } from './settlementLayout.ts';
import { parseStructureCatalogue } from './structures.ts';
import type { Building, DiamondFooting, FootingOf, LaidOut } from './settlementLayout.ts';
import { inSquare, onStreet } from './settlements.ts';

const land: FootingOf = () => 'land';
/** The sea to the front and right of a middle at the origin, past a shore running across the square's corner. */
const shore: FootingOf = (u, v) => (u + v > 5 ? 'water' : 'land');

const laid = (one: LaidOut | 'unknown'): LaidOut => {
  if (one === 'unknown') throw new Error('laid out on ground not known');
  return one;
};

function baseOf(building: Building): [number, number][] {
  const diamonds: [number, number][] = [];
  for (let u = building.u - building.side; u < building.u; u += 1) {
    for (let v = building.v - building.side; v < building.v; v += 1) diamonds.push([u, v]);
  }
  return diamonds;
}

describe('a settlement laid out', () => {
  it("has the square the structures' catalogue gives its type at each level", () => {
    const catalogue = parseStructureCatalogue(
      readFileSync(new URL('../../../../world/catalogues/structures.json', import.meta.url), 'utf8'),
    );
    for (const type of ['village', 'fishingVillage']) {
      expect(catalogue.types.find((one) => one.type === type)?.footprint).toEqual([...SETTLEMENT_SIDES]);
      expect(laid(settlementIn('a', 'village', 2, 'european', 0, 0, land)).square.side).toBe(
        SETTLEMENT_SIDES[1],
      );
    }
  });

  it('is the same every time it is laid out, from its id alone', () => {
    const one = settlementIn('structure-a', 'village', 3, 'european', 0, 0, land);
    expect(settlementIn('structure-a', 'village', 3, 'european', 0, 0, land)).toEqual(one);
    expect(settlementIn('structure-b', 'village', 3, 'european', 0, 0, land)).not.toEqual(one);
  });

  it('holds every building of a lower level at a higher one, and more about them', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const hamlet = laid(settlementIn(id, 'village', 1, 'islamic', 10, -4, land)).buildings;
      const village = laid(settlementIn(id, 'village', 2, 'islamic', 10, -4, land)).buildings;
      const large = laid(settlementIn(id, 'village', 3, 'islamic', 10, -4, land)).buildings;
      for (const building of hamlet) expect(village).toContainEqual(building);
      for (const building of village) expect(large).toContainEqual(building);
      expect(large.length).toBeGreaterThan(hamlet.length);
    }
  });

  it('keeps its streets clear and every building inside its square', () => {
    for (const id of ['a', 'b', 'c']) {
      const { square, buildings } = laid(settlementIn(id, 'village', 3, 'eastAsian', 3, 7, land));
      for (const building of buildings) {
        for (const [u, v] of baseOf(building)) {
          expect(inSquare(square, u, v)).toBe(true);
          expect(onStreet(square, u, v)).toBe(false);
        }
      }
    }
  });

  it('stands a chapel only from a village up, and one at most', () => {
    let chapels = 0;
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(
        laid(settlementIn(id, 'village', 1, 'african', 0, 0, land)).buildings.some(
          (one) => one.piece === 'chapel',
        ),
      ).toBe(false);
      const village = laid(settlementIn(id, 'village', 3, 'african', 0, 0, land)).buildings;
      expect(village.filter((one) => one.piece === 'chapel').length).toBeLessThanOrEqual(1);
      chapels += village.filter((one) => one.piece === 'chapel').length;
    }
    expect(chapels).toBeGreaterThan(0);
  });

  it('stands no building on water, and a fishing village its huts by the water with a jetty out into it', () => {
    let jetties = 0;
    let boats = 0;
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const { buildings, jetties: out } = laid(
        settlementIn(id, 'fishingVillage', 3, 'european', 0, 0, shore),
      );
      for (const building of buildings) {
        const wanted: DiamondFooting = building.piece === 'boat' ? 'water' : 'land';
        for (const [u, v] of baseOf(building)) expect(shore(u, v), `${id} ${building.piece}`).toBe(wanted);
      }
      expect(buildings.some((one) => one.piece === 'fishingHut')).toBe(true);
      for (const jetty of out) expect(shore(Math.floor(jetty.u), Math.floor(jetty.v))).toBe('water');
      jetties += out.length;
      boats += buildings.filter((one) => one.piece === 'boat').length;
    }
    expect(jetties).toBeGreaterThan(0);
    expect(boats).toBeGreaterThan(0);
  });

  it('is not laid out until all the ground about it is known', () => {
    const partly: FootingOf = (u, v) => (u > 8 && v > 8 ? null : 'land');
    expect(settlementIn('a', 'village', 3, 'european', 0, 0, partly)).toBe('unknown');
  });
});

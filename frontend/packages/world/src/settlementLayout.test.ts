import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BUILDING_SIDES, SETTLEMENT_SIDES, settlementIn } from './settlementLayout.ts';
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

function baseOf(building: { u: number; v: number; side: number }): [number, number][] {
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

  it('holds every building of a lower level at a higher one, and more about them, but where the market stands', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const hamlet = laid(settlementIn(id, 'village', 1, 'islamic', 10, -4, land)).buildings;
      const village = laid(settlementIn(id, 'village', 2, 'islamic', 10, -4, land)).buildings;
      const large = laid(settlementIn(id, 'village', 3, 'islamic', 10, -4, land)).buildings;
      const market = large.find((one) => one.type === 'market');
      const underMarket = (building: Building) =>
        market !== undefined &&
        baseOf(building).some(([u, v]) => baseOf(market).some(([mu, mv]) => mu === u && mv === v));
      for (const building of hamlet) expect(village).toContainEqual(building);
      for (const building of village) if (!underMarket(building)) expect(large).toContainEqual(building);
      expect(large.length).toBeGreaterThan(hamlet.length);
    }
  });

  it('is built of houses, and the catalogue gives each building the side it is laid out at', () => {
    const catalogue = parseStructureCatalogue(
      readFileSync(new URL('../../../../world/catalogues/structures.json', import.meta.url), 'utf8'),
    );
    for (const [type, side] of Object.entries(BUILDING_SIDES)) {
      expect(catalogue.types.find((one) => one.type === type)?.footprint[0], type).toBe(side);
    }
    const buildings = laid(settlementIn('a', 'village', 2, 'european', 0, 0, land)).buildings;
    expect(buildings.filter((one) => one.type === 'house').length).toBeGreaterThan(3);
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

  it('stands a market only in a large village, and a mill only by the water from a village up, one of each at most', () => {
    const riverside: FootingOf = (u) => (u === 6 ? 'river' : u === 7 ? 'water' : 'land');
    let mills = 0;
    let markets = 0;
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const hamlet = laid(settlementIn(id, 'village', 1, 'african', 0, 0, riverside)).buildings;
      expect(hamlet.some((one) => one.type !== 'house')).toBe(false);
      const dry = laid(settlementIn(id, 'village', 3, 'african', 0, 0, land)).buildings;
      expect(dry.some((one) => one.type === 'mill')).toBe(false);
      const large = laid(settlementIn(id, 'village', 3, 'african', 0, 0, riverside)).buildings;
      expect(large.filter((one) => one.type === 'mill').length).toBeLessThanOrEqual(1);
      expect(large.filter((one) => one.type === 'market').length).toBeLessThanOrEqual(1);
      mills += large.filter((one) => one.type === 'mill').length;
      markets += large.filter((one) => one.type === 'market').length;
      const village = laid(settlementIn(id, 'village', 2, 'african', 0, 0, riverside)).buildings;
      expect(village.some((one) => one.type === 'market')).toBe(false);
    }
    expect(mills).toBeGreaterThan(0);
    expect(markets).toBeGreaterThan(0);
  });

  it('stands no building on water, and a fishing village its houses by the water with a jetty out into it', () => {
    let jetties = 0;
    let boats = 0;
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const {
        buildings,
        dress,
        jetties: out,
      } = laid(settlementIn(id, 'fishingVillage', 3, 'european', 0, 0, shore));
      for (const building of buildings) {
        for (const [u, v] of baseOf(building)) expect(shore(u, v), `${id} ${building.type}`).toBe('land');
      }
      for (const one of dress) {
        const wanted: DiamondFooting = one.piece === 'boat' ? 'water' : 'land';
        for (const [u, v] of baseOf(one)) expect(shore(u, v), `${id} ${one.piece}`).toBe(wanted);
      }
      expect(buildings.some((one) => one.type === 'house')).toBe(true);
      for (const jetty of out) expect(shore(Math.floor(jetty.u), Math.floor(jetty.v))).toBe('water');
      jetties += out.length;
      boats += dress.filter((one) => one.piece === 'boat').length;
    }
    expect(jetties).toBeGreaterThan(0);
    expect(boats).toBeGreaterThan(0);
  });

  it('is not laid out until all the ground about it is known', () => {
    const partly: FootingOf = (u, v) => (u > 8 && v > 8 ? null : 'land');
    expect(settlementIn('a', 'village', 3, 'european', 0, 0, partly)).toBe('unknown');
  });
});

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BUILDING_SIDES, SETTLEMENT_SIDES, settlementIn } from './settlementLayout.ts';
import { parseStructureCatalogue } from './structures.ts';
import type { DiamondFooting, FootingOf, LaidOut } from './settlementLayout.ts';
import { inSquare, onStreet, parseSettlements } from './settlements.ts';

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
  it('has a square of its level, which the radius world/settlements.json gives the level reaches every corner of', () => {
    const file = parseSettlements(
      readFileSync(new URL('../../../../world/settlements.json', import.meta.url), 'utf8'),
    );
    for (const level of [1, 2, 3]) {
      const { side } = laid(settlementIn('a', 'village', level, 'european', 0, 0, land)).square;
      expect(side).toBe(SETTLEMENT_SIDES[level - 1]);
      expect(file.radius[level - 1]).toBeGreaterThanOrEqual((side / 2) * Math.SQRT2 - 0.5);
    }
  });

  it('is the same every time it is laid out, from its id alone', () => {
    const one = settlementIn('structure-a', 'village', 3, 'european', 0, 0, land);
    expect(settlementIn('structure-a', 'village', 3, 'european', 0, 0, land)).toEqual(one);
    expect(settlementIn('structure-b', 'village', 3, 'european', 0, 0, land)).not.toEqual(one);
  });

  it('holds every building of a lower level at a higher one, and more, but where a block takes a larger one', () => {
    for (const id of 'abcdefghijklmnop') {
      const hamlet = laid(settlementIn(id, 'village', 1, 'islamic', 10, -4, land)).buildings;
      const village = laid(settlementIn(id, 'village', 2, 'islamic', 10, -4, land)).buildings;
      const large = laid(settlementIn(id, 'village', 3, 'islamic', 10, -4, land)).buildings;
      // A village's quarter may be one block holding a larger building, where the hamlet had a lot.
      const larger = village.filter((one) => one.side > 3);
      const underLarger = (building: { u: number; v: number; side: number }) =>
        larger.some((one) =>
          baseOf(building).some(([u, v]) => baseOf(one).some(([bu, bv]) => bu === u && bv === v)),
        );
      for (const building of hamlet) if (!underLarger(building)) expect(village).toContainEqual(building);
      for (const building of village) expect(large).toContainEqual(building);
      expect(large.length).toBeGreaterThan(hamlet.length);
    }
  });

  it("is built about half of houses and half of the catalogue's other buildings, each at the catalogue's side", () => {
    const catalogue = parseStructureCatalogue(
      readFileSync(new URL('../../../../world/catalogues/structures.json', import.meta.url), 'utf8'),
    );
    for (const [type, side] of Object.entries(BUILDING_SIDES)) {
      expect(catalogue.types.find((one) => one.type === type)?.footprint[0], type).toBe(side);
    }
    const all = Array.from({ length: 80 }, (_, at) => at).flatMap(
      (at) => laid(settlementIn(`site:${at}`, 'village', 1 + (at % 3), 'european', 0, 0, land)).buildings,
    );
    const houses = all.filter((one) => one.type === 'house').length / all.length;
    expect(houses).toBeGreaterThan(0.4);
    expect(houses).toBeLessThan(0.7);
    expect(new Set(all.map((one) => one.type)).size).toBeGreaterThan(8);
    // Never what a house raises for its seat, nor what is wider than two lots.
    expect(all.some((one) => (one.type as string) === 'castle' || (one.type as string) === 'palace')).toBe(
      false,
    );
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

  it('stands a larger building only on a block from a village up, a harbour or shipyard only by open water, and a mill only by the water', () => {
    const riverside: FootingOf = (u) => (u === 6 ? 'river' : u === 7 ? 'water' : 'land');
    const larger = (one: { side: number }) => one.side > 3;
    let mills = 0;
    let blocks = 0;
    for (const id of 'abcdefghijklmnopqrst') {
      const hamlet = laid(settlementIn(id, 'village', 1, 'african', 0, 0, riverside)).buildings;
      expect(hamlet.some(larger)).toBe(false);
      const dry = laid(settlementIn(id, 'village', 3, 'african', 0, 0, land)).buildings;
      expect(dry.some((one) => one.type === 'mill')).toBe(false);
      expect(dry.some((one) => one.type === 'harbour' || one.type === 'shipyard')).toBe(false);
      const large = laid(settlementIn(id, 'village', 3, 'african', 0, 0, riverside)).buildings;
      expect(large.filter((one) => one.type === 'mill').length).toBeLessThanOrEqual(1);
      expect(large.filter(larger).length).toBeLessThanOrEqual(4);
      mills += large.filter((one) => one.type === 'mill').length;
      blocks += dry.filter(larger).length;
    }
    expect(mills).toBeGreaterThan(0);
    expect(blocks).toBeGreaterThan(0);
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

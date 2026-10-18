import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseStructureCatalogue } from './structures.ts';

const fixture = readFileSync(
  new URL('../../../../contracts/fixtures/structures.json', import.meta.url),
  'utf8',
);
const world = readFileSync(new URL('../../../../world/catalogues/structures.json', import.meta.url), 'utf8');

describe('the catalogue of structures', () => {
  it('reads the shared fixture as the server does, and keeps what the server passes over', () => {
    const { types } = parseStructureCatalogue(fixture);
    expect(types.map((one) => one.type)).toEqual(['castle', 'watchtower']);

    const [castle, watchtower] = types;
    expect(castle!.levels).toBe(2);
    expect(castle!.significance[1]).toBe(24);
    expect(castle!.sightKm[1]).toBe(40);
    expect(castle!.yields).toEqual({ naturalDomain: [3, 5], wealth: [0, 2] });
    expect(castle!.groundHeight).toEqual([4, 4.5]);
    expect(castle!.footprint).toEqual([3, 4]);
    expect(castle!.zone).toEqual({ reach: 25 });
    expect(castle!.words.islamic).toBe('kasbah');

    const [lord, cells] = castle!.slots;
    expect(lord).toMatchObject({ name: 'lord', takes: 'character', places: [1, 1], seenBy: 'all' });
    expect(lord).toMatchObject({ needed: true, scales: 'piety', bringsItsOwn: false, adds: {} });
    expect(cells).toMatchObject({
      takes: 'either',
      places: [2, 4],
      seenBy: 'holder',
      adds: { influence: 1 },
    });
    expect(cells).toMatchObject({ needed: false, scales: null, bringsItsOwn: true });

    expect(watchtower).toMatchObject({ levels: 1, yields: {}, zone: null, slots: [] });
    expect(watchtower!.words.african).toBe('watchtower');
  });

  it("reads the world's own, sixteen types of three levels", () => {
    const { types } = parseStructureCatalogue(world);
    expect(types).toHaveLength(16);
    expect(types.every((one) => one.levels === 3)).toBe(true);
  });

  it('refuses a field it cannot read, naming the type and the field', () => {
    const broken = fixture.replace('"sightKm": [50]', '"sightKm": ["far"]');
    expect(() => parseStructureCatalogue(broken)).toThrow(
      'world/catalogues/structures.json: watchtower has no sightKm the page can read',
    );
  });

  it('refuses a footprint that is not whole diamonds, one to each level', () => {
    expect(() => parseStructureCatalogue(fixture.replace('"footprint": [2]', '"footprint": [2.5]'))).toThrow(
      'watchtower has no footprint of whole diamonds',
    );
    expect(() => parseStructureCatalogue(fixture.replace('"footprint": [3, 4]', '"footprint": [3]'))).toThrow(
      'castle has no footprint the page can read',
    );
  });

  it('refuses a slot that has fewer places a level higher', () => {
    const broken = fixture.replace('"places": [2, 4]', '"places": [4, 2]');
    expect(() => parseStructureCatalogue(broken)).toThrow('castle has no slots.cells.places');
  });
});

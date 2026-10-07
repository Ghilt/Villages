import { describe, expect, it } from 'vitest';

import { asIn1790, townsAdded } from './review1790.ts';

describe('a name as the review of 1790 decides it', () => {
  it('gives a reviewed river its name of 1790, with the name of today beside it, and says it is of 1790', () => {
    expect(asIn1790('river', 'Tajo', 'Tajo', ['Tagus', 'Tagus'])).toEqual({
      name: 'Tagus',
      also: 'Tajo',
      form: '1790',
    });
    expect(asIn1790('river', undefined, 'Daugava', ['Dwina', 'Daugava', 'why'])).toEqual({
      name: 'Dwina',
      also: 'Daugava',
      form: '1790',
    });
  });

  it('leaves a river the review has not reached under the English name of the source, its own beside it', () => {
    expect(asIn1790('river', 'Dnieper', 'Dnipro', undefined)).toEqual({ name: 'Dnieper', also: 'Dnipro' });
    expect(asIn1790('river', undefined, 'Vistula', undefined)).toEqual({ name: 'Vistula' });
  });

  it('carries a canal only where the review names it, and nothing it says was not there', () => {
    expect(asIn1790('river', 'Suez Canal', 'Suez Canal', undefined)).toBeNull();
    expect(
      asIn1790('river', 'Gharraf Canal', 'Gharraf Canal', ['Shatt al Hai', 'Shatt al-Gharraf'])?.name,
    ).toBe('Shatt al Hai');
    expect(asIn1790('river', 'Ferenc Csatorna', 'Ferenc Csatorna', [null, 'Ferenc Canal'])).toBeNull();
  });

  it('never shows beside a name the same one again, or one the source mangled', () => {
    expect(asIn1790('river', undefined, 'Klarlven', ['Klarälven', 'Klarälven'])).toEqual({
      name: 'Klarälven',
      form: '1790',
    });
    expect(asIn1790('river', undefined, 'Kiz?lirmak', ['Kizil Irmak', 'Kizil Irmak'])?.also).toBeUndefined();
    expect(asIn1790('river', undefined, 'pisuerga', ['Pisuerga', 'Pisuerga'])?.also).toBeUndefined();
  });

  it('writes a lake as English does, where the source gives only its stem', () => {
    expect(asIn1790('lake', 'Erie', 'Lake Erie', undefined)).toEqual({ name: 'Lake Erie' });
    expect(asIn1790('lake', 'Woods', 'Lake of the Woods', undefined)?.name).toBe('Lake of the Woods');
    expect(asIn1790('lake', 'Great Bear', 'Great Bear Lake', undefined)?.name).toBe('Great Bear Lake');
    expect(asIn1790('lake', 'Constance', 'Bodensee', undefined)).toEqual({
      name: 'Lake Constance',
      also: 'Bodensee',
    });
    expect(asIn1790('lake', 'Mälaren', 'Mälaren', undefined)).toEqual({ name: 'Lake Mälaren' });
    expect(asIn1790('lake', 'Dead Sea', 'Dead Sea', undefined)?.name).toBe('Dead Sea');
    expect(asIn1790('lake', 'Issyk-Kul', 'Issyk-Kul', undefined)?.name).toBe('Issyk-Kul');
    expect(asIn1790('lake', 'Constance', 'Bodensee', ['Lake of Constance', 'Bodensee'])?.name).toBe(
      'Lake of Constance',
    );
  });

  it('carries a reservoir only where the review names it, as a lake a dam only raised', () => {
    expect(asIn1790('lake', 'Nasser', 'Lake Nasser', undefined, true)).toBeNull();
    expect(asIn1790('lake', 'Ilmen', "Lake Il'Men'", ['Lake Ilmen', 'Lake Ilmen'], true)?.name).toBe(
      'Lake Ilmen',
    );
    expect(asIn1790('lake', 'Rybinsk', 'Rybinsk Reservoir', [null, 'Rybinsk'], true)).toBeNull();
  });

  it('names a sea by the review too, and leaves an unreviewed one its English name', () => {
    expect(asIn1790('sea', 'North Sea', 'North Sea', ['German Ocean', 'North Sea'])).toEqual({
      name: 'German Ocean',
      also: 'North Sea',
      form: '1790',
    });
    expect(asIn1790('sea', 'Bay of Campeche', 'Bahía de Campeche', undefined)).toEqual({
      name: 'Bay of Campeche',
      also: 'Bahía de Campeche',
    });
    expect(asIn1790('sea', 'Southern Ocean', 'SOUTHERN OCEAN', undefined)).toEqual({
      name: 'Southern Ocean',
    });
  });
});

describe('the towns the review adds beside the source', () => {
  it('stands each where the review puts it, under its name of 1790, and leaves out one the source has', () => {
    const added = townsAdded(
      {
        Q339258: ['Mocha', 'Mokha', 'the coffee port', [43.25, 13.317]],
        Q653988: ['Seringapatam', 'Srirangapatna', "Tipu Sultan's capital", [76.695, 12.418]],
        Q1792: ['Dantzic', 'Gdańsk', 'twice', [18.64, 54.36]],
      },
      new Set(['Q1792']),
      4.5,
    );
    expect(added.map((town) => town.name)).toEqual(['Mocha', 'Seringapatam']);
    expect(added[0]).toEqual({
      id: 'Q339258',
      kind: 'town',
      name: 'Mocha',
      also: 'Mokha',
      rank: 6,
      from: 4.5,
      form: '1790',
      lines: [[[43.25, 13.317]]],
    });
  });
});

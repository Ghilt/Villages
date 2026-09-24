import { describe, expect, it } from 'vitest';

import { dayOf } from '@villages/protocol';
import type { KeyFigureView } from '@villages/protocol';

import { introduce, whatChanged } from './describe';

const today = dayOf(1790, 5, 9);

const ravenscar = {
  id: '6d5b0a2e-1c3f-4d7e-9a8b-0f1e2d3c4b5a',
  name: 'Ravenscar',
  banner: { field: 'sable', division: 'plain', charge: 'stag', chargeTincture: 'argent' },
} as const;

function figure(over: Partial<KeyFigureView> = {}): KeyFigureView {
  return {
    id: 'cb732500-39bd-3b39-a838-bb89f719578f',
    givenName: 'Agnes',
    familyName: 'Hollin',
    sex: 'woman',
    species: 'person',
    bornOn: dayOf(1756, 2, 1),
    agedYears: 0,
    stats: { piety: 13, reason: 9, kindness: 11, physical: 7 },
    portrait: 'woman-03',
    keyFigureOf: [ravenscar],
    version: 4,
    ...over,
  };
}

const wilhelm = figure({
  id: 'cb732500-39bd-3b39-a838-bb89f7195790',
  givenName: 'Wilhelm',
  familyName: 'Ystad',
  sex: 'man',
  bornOn: dayOf(1741, 11, 20),
});

describe('introducing a key figure', () => {
  it('gives the name, the sex and the age worked out from the birthday', () => {
    expect(introduce(figure(), today)).toBe('Agnes Hollin, a woman of 34');
  });

  it('leaves the age out until the world has said what day it is', () => {
    expect(introduce(figure(), null)).toBe('Agnes Hollin, a woman');
  });
});

describe('what a new list of key figures is worth saying', () => {
  it('says the first list whole, because it is what the player arrived to', () => {
    expect(whatChanged(null, [figure(), wilhelm], today)).toEqual([
      '2 key figures: Agnes Hollin, a woman of 34; Wilhelm Ystad, a man of 48',
    ]);
    expect(whatChanged(null, [], today)).toEqual(['no key figures yet']);
  });

  it('says a newcomer once, and nothing about the figures that did not change', () => {
    expect(whatChanged([figure()], [figure(), wilhelm], today)).toEqual([
      'Wilhelm Ystad, a man of 48, is a key figure of your house now',
    ]);
  });

  it('says which stat moved, from what and to what', () => {
    const stronger = figure({ stats: { piety: 13, reason: 9, kindness: 11, physical: 8 }, version: 5 });

    expect(whatChanged([figure()], [stronger], today)).toEqual(['Agnes Hollin: physical went from 7 to 8']);
  });

  it('says an ageing out of the ordinary either way, and the age it came to', () => {
    expect(whatChanged([figure()], [figure({ agedYears: 10 })], today)).toEqual([
      'Agnes Hollin: was aged 10 years, and is 44',
    ]);
    expect(whatChanged([figure()], [figure({ agedYears: -1 })], today)).toEqual([
      'Agnes Hollin: was made 1 year younger, and is 33',
    ]);
  });

  it('says another portrait, and none', () => {
    expect(whatChanged([figure()], [figure({ portrait: 'woman-05' })], today)).toEqual([
      'Agnes Hollin: has another portrait, woman-05',
    ]);
    expect(whatChanged([figure()], [figure({ portrait: undefined })], today)).toEqual([
      'Agnes Hollin: has no portrait now',
    ]);
  });

  it('says a figure who left the list, whatever took them', () => {
    expect(whatChanged([figure(), wilhelm], [wilhelm], today)).toEqual([
      'Agnes Hollin is no longer a key figure of your house',
    ]);
  });

  it('says nothing when nothing changed', () => {
    expect(whatChanged([figure(), wilhelm], [figure(), wilhelm], today)).toEqual([]);
  });
});

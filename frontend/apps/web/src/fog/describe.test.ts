import { describe, expect, it } from 'vitest';
import type { VisionPointView } from '@villages/protocol';

import { describeSight, lastingOn } from './describe';

const TODAY = 653_709;
const AGNES = 'cb732500-39bd-3b39-a838-bb89f719578f';

const CASTLE = '5d000000-0000-4000-8000-0000000000ca';
const castle: VisionPointView = {
  kind: 'given',
  of: 'dd000000-0000-4000-8000-0000000000ca',
  place: { lat: 59.33, lon: 18.07 },
  radius: 34,
  since: 653_705,
  from: CASTLE,
};
const inUppsala: VisionPointView = {
  kind: 'keyFigure',
  of: AGNES,
  place: { lat: 59.86, lon: 17.64 },
  radius: 34,
  since: 653_706,
  until: TODAY,
};
const onGotland: VisionPointView = {
  kind: 'keyFigure',
  of: AGNES,
  place: { lat: 57.64, lon: 18.3 },
  radius: 34,
  since: TODAY,
};

const names = (id: string) => ({ [AGNES]: 'Agnes Hollin', [CASTLE]: 'Ravenscar Castle' })[id];

describe('what the log says about what a house sees', () => {
  it('says there is nothing to see from before there is a house', () => {
    expect(describeSight([], TODAY, names)).toBe('no vision yet: there is no house to see from');
  });

  it('names the castle the house sees from, and how far it sees', () => {
    expect(describeSight([castle], TODAY, names)).toBe(
      'Ravenscar Castle gives vision, 34 km around it; 1 place seen from in all',
    );
  });

  it('names who gives vision now, and counts the places seen from that have ended too', () => {
    expect(describeSight([castle, inUppsala, onGotland], TODAY, names)).toBe(
      'Ravenscar Castle and Agnes Hollin give vision, 34 km around each; 3 places seen from in all',
    );
  });

  it('calls a key figure it has no name for a key figure', () => {
    expect(describeSight([onGotland], TODAY, () => undefined)).toBe(
      'a key figure gives vision, 34 km around it; 1 place seen from in all',
    );
  });

  it('names a vision given outright by where it is', () => {
    const given: VisionPointView = {
      kind: 'given',
      of: 'dd000000-0000-4000-8000-000000000001',
      place: { lat: 55.68, lon: 12.57 },
      radius: 34,
      since: TODAY,
    };
    expect(describeSight([castle, given], TODAY, names)).toBe(
      'Ravenscar Castle and the vision given at 55.68, 12.57 give vision, 34 km around each; 2 places seen from in all',
    );
  });

  it('names a structure a vision is seen from, and says each reach beside its giver when they differ', () => {
    const mill: VisionPointView = {
      kind: 'given',
      of: 'dd000000-0000-4000-8000-000000000002',
      place: { lat: -63.265, lon: -56.15 },
      radius: 6,
      since: TODAY,
      from: '5d000000-0000-4000-8000-000000000001',
    };
    const named = (id: string) => (id === mill.from ? 'the Antarctic mill' : names(id));

    expect(describeSight([castle, mill], TODAY, named)).toBe(
      'Ravenscar Castle (34 km) and the Antarctic mill (6 km) give vision; 2 places seen from in all',
    );
    expect(describeSight([mill], TODAY, () => undefined)).toBe(
      'a structure gives vision, 6 km around it; 1 place seen from in all',
    );
  });

  it('says so when everything has ended', () => {
    expect(describeSight([inUppsala], TODAY, names)).toBe(
      'nothing gives vision now; 1 place seen from in all',
    );
  });
});

describe('whether a vision point still gives vision', () => {
  it('lasts while it has no end, and stops on the day it ends', () => {
    expect(lastingOn(castle, TODAY)).toBe(true);
    expect(lastingOn(inUppsala, TODAY)).toBe(false);
    expect(lastingOn(inUppsala, TODAY - 1)).toBe(true);
  });
});

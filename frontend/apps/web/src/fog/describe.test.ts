import { describe, expect, it } from 'vitest';
import type { VisionPointView } from '@villages/protocol';

import { describeSight, lastingOn } from './describe';

const TODAY = 653_709;
const AGNES = 'cb732500-39bd-3b39-a838-bb89f719578f';

const seat: VisionPointView = { kind: 'seat', place: { lat: 59.33, lon: 18.07 }, radius: 34, since: 653_705 };
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

const names = (id: string) => (id === AGNES ? 'Agnes Hollin' : undefined);

describe('what the log says about what a house sees', () => {
  it('says there is nothing to see from before there is a house', () => {
    expect(describeSight([], TODAY, names)).toBe('no vision yet: there is no house to see from');
  });

  it('names the seat, and how far it sees', () => {
    expect(describeSight([seat], TODAY, names)).toBe(
      'the seat gives vision, 34 km around it; 1 place seen from in all',
    );
  });

  it('names who gives vision now, and counts the places seen from that have ended too', () => {
    expect(describeSight([seat, inUppsala, onGotland], TODAY, names)).toBe(
      'the seat and Agnes Hollin give vision, 34 km around each; 3 places seen from in all',
    );
  });

  it('calls a key figure it has no name for a key figure', () => {
    expect(describeSight([onGotland], TODAY, () => undefined)).toBe(
      'a key figure gives vision, 34 km around it; 1 place seen from in all',
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
    expect(lastingOn(seat, TODAY)).toBe(true);
    expect(lastingOn(inUppsala, TODAY)).toBe(false);
    expect(lastingOn(inUppsala, TODAY - 1)).toBe(true);
  });
});

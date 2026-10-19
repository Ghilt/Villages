import { describe, expect, it } from 'vitest';

import { HOUSE_WAIT_MS, LONGEST_MS, nextStep, shareDrawn } from './rules';
import type { StartupFacts } from './rules';

const SEAT = 'the seat at 41.2, 99.7';

/** A page a second in, its map ready, the house heard, the camera on the seat and everything drawn. */
const READY: StartupFacts = {
  now: 1_000,
  mapReadyAt: 500,
  houseHeard: true,
  wanted: SEAT,
  placed: SEAT,
  drawn: true,
  inHand: 0,
};

describe('starting up', () => {
  it('waits for the map', () => {
    expect(nextStep({ ...READY, mapReadyAt: null, placed: null, drawn: false }).step).toBe('wait');
  });

  it('waits for the gateway to say whether there is a house, and no longer than it should', () => {
    const asking = { ...READY, houseHeard: false, wanted: 'where it opened', placed: null, drawn: false };

    expect(nextStep({ ...asking, now: 500 + HOUSE_WAIT_MS - 1 }).step).toBe('wait');
    expect(nextStep({ ...asking, now: 500 + HOUSE_WAIT_MS }).step).toBe('place');
  });

  it('puts the camera on the seat once it is heard of, and waits there until the map is drawn', () => {
    expect(nextStep({ ...READY, placed: null, drawn: false }).step).toBe('place');
    expect(nextStep({ ...READY, drawn: false }).step).toBe('wait');
  });

  it('waits for the work in hand as well as the map', () => {
    expect(nextStep({ ...READY, inHand: 2 }).step).toBe('wait');
  });

  it('lifts once the map is drawn where the camera was put and nothing is in hand', () => {
    expect(nextStep(READY)).toEqual({ step: 'lift', cutShort: false });
  });

  it('goes to a house heard of after the camera was put where the page opened', () => {
    expect(nextStep({ ...READY, placed: 'where it opened' }).step).toBe('place');
  });

  it('lifts at the longest whatever is still coming', () => {
    const stuck = { ...READY, mapReadyAt: null, houseHeard: false, placed: null, drawn: false, inHand: 3 };

    expect(nextStep({ ...stuck, now: LONGEST_MS })).toEqual({ step: 'lift', cutShort: true });
  });
});

describe('how far along the drawing is', () => {
  it('is the requests ended out of every one asked', () => {
    expect(shareDrawn(0, 30, 10, false)).toBe(0.75);
  });

  it('never goes back, and is nothing while nothing has been asked', () => {
    expect(shareDrawn(0.75, 30, 30, false)).toBe(0.75);
    expect(shareDrawn(0, 0, 0, false)).toBe(0);
  });

  it('is full once the map has nothing left to draw', () => {
    expect(shareDrawn(0.2, 3, 9, true)).toBe(1);
  });
});

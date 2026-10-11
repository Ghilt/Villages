import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LINKED_ZOOM, mapLink, startAtIn } from '../net/startAt';
import { placeIn } from './eventLinks';

/** An event as the shared fixtures store it, by its type. */
const stored = (type: string): unknown =>
  (
    JSON.parse(
      readFileSync(new URL(`../../../../../contracts/fixtures/events/${type}.json`, import.meta.url), 'utf8'),
    ) as { data: unknown }
  ).data;

describe('the place an event names', () => {
  it('is where a structure was raised, a house founded and vision gained, as the store has them', () => {
    expect(placeIn(stored('villages.structure.raised.v1'))).toEqual({ lat: -77.4, lon: 10 });
    expect(placeIn(stored('villages.house.founded.v1'))).not.toBeNull();
    expect(placeIn(stored('villages.house.gainedVision.v1'))).toEqual({ lat: 57.64, lon: 18.3 });
  });

  it('is the first one in the data, however deep, for an event that names several', () => {
    const offered = {
      options: [{ effect: { seat: { lat: 59.3, lon: 18.1 } } }, { effect: { seat: { lat: 1, lon: 2 } } }],
    };

    expect(placeIn(offered)).toEqual({ lat: 59.3, lon: 18.1 });
  });

  it('is nowhere for an event that names none, or a pair of numbers that is not a place', () => {
    expect(placeIn(stored('villages.house.resourceGranted.v1'))).toBeNull();
    expect(placeIn({ lat: 120, lon: 10 })).toBeNull();
    expect(placeIn({ lat: '59', lon: 18 })).toBeNull();
  });
});

describe('the address that opens the game over a place', () => {
  it('is read back as the place it was written for', () => {
    const link = mapLink({ lat: -77.4, lon: 10 });

    expect(startAtIn(link.slice(link.indexOf('?')))).toEqual({ lat: -77.4, lon: 10, zoom: LINKED_ZOOM });
  });

  it('asks nothing of a game opened plainly, or with an address that is not a place', () => {
    expect(startAtIn('')).toBeNull();
    expect(startAtIn('?at=-77.4')).toBeNull();
    expect(startAtIn('?at=north,10')).toBeNull();
    expect(startAtIn('?at=-77.4,200')).toBeNull();
  });

  it('takes a zoom of its own when it is given one', () => {
    expect(startAtIn('?at=59.3,18.1&zoom=7.5')).toEqual({ lat: 59.3, lon: 18.1, zoom: 7.5 });
  });
});

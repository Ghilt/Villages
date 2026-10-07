import { describe, expect, it } from 'vitest';

import type { VisionPointView } from '@villages/protocol';

import { seenUntil } from './sighting';

const TODAY = 1000;
const STOCKHOLM = { lat: 59.33, lon: 18.07 };
const HELSINKI = { lat: 60.17, lon: 24.94 };

const seat: VisionPointView = { kind: 'seat', place: STOCKHOLM, radius: 34, since: 10 };
/** A key figure who stood in Helsinki from day 200 and walked on on day 400. */
const walkedOn: VisionPointView = {
  kind: 'keyFigure',
  of: 'agnes',
  place: HELSINKI,
  radius: 34,
  since: 200,
  until: 400,
};

/**
 * What a window on a house says beside its name: `current` while the house's vision covers it, or the day the fog
 * hid it. See decision record 0088.
 */
describe('when a place was last seen', () => {
  it('is now, while the vision covers it', () => {
    expect(seenUntil(STOCKHOLM, { points: [seat, walkedOn], tension: 40 }, TODAY)).toBe('now');
  });

  it('is the day the fog hid it, once the point that saw it has ended', () => {
    expect(seenUntil(HELSINKI, { points: [seat, walkedOn], tension: 40 }, TODAY)).toBe(400);
  });

  it('is nothing, where the house never saw at all', () => {
    expect(seenUntil({ lat: 0, lon: 0 }, { points: [seat, walkedOn], tension: 40 }, TODAY)).toBeNull();
  });

  // In the world a day is most of an hour, and a key figure walked there and back within one is still a sighting.
  it('is the day itself, for a point begun and ended on one day', () => {
    const passing: VisionPointView = { ...walkedOn, since: 900, until: 900 };
    const today: VisionPointView = { ...walkedOn, since: TODAY, until: TODAY };

    expect(seenUntil(HELSINKI, { points: [seat, passing], tension: 40 }, TODAY)).toBe(900);
    expect(seenUntil(HELSINKI, { points: [seat, today], tension: 40 }, TODAY)).toBe(TODAY);
  });

  it('is the end of the latest stretch, when the place was seen more than once', () => {
    const again: VisionPointView = { ...walkedOn, since: 600, until: 700 };

    expect(seenUntil(HELSINKI, { points: [seat, walkedOn, again], tension: 40 }, TODAY)).toBe(700);
  });
});

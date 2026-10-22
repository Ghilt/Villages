import { describe, expect, it } from 'vitest';

import { createArrival, realWorldWanted } from './arrival';
import { BECOMES_A_MARK_AT, CROSSFADE_MS } from './twoForms';

describe('the real world arriving on the map', () => {
  it('comes in at the zoom the map changes over at, and not a little before it', () => {
    expect(realWorldWanted(BECOMES_A_MARK_AT + 0.1, false)).toBe(true);
    expect(realWorldWanted(BECOMES_A_MARK_AT, false)).toBe(false);
    expect(realWorldWanted(7, false)).toBe(false);
  });

  it('stays while the camera jitters about that zoom, and goes once it is clearly out', () => {
    expect(realWorldWanted(BECOMES_A_MARK_AT - 0.05, true)).toBe(true);
    expect(realWorldWanted(BECOMES_A_MARK_AT - 0.1, true)).toBe(false);
  });

  it('fades in time, wanting frames until it has landed, whatever zoom the camera rests at', () => {
    const arrival = createArrival();
    expect(arrival.step(8, 0)).toBe(0);
    const halfway = arrival.step(8, CROSSFADE_MS / 2);
    expect(halfway).toBeCloseTo(0.5);
    expect(arrival.wants()).toBe(0);
    expect(arrival.step(8, CROSSFADE_MS)).toBe(1);
    expect(arrival.wants()).toBeNull();
    // Resting at 7.75, inside where it used to fade by zoom, it is whole.
    expect(arrival.step(7.75, 16)).toBe(1);
    arrival.step(6, CROSSFADE_MS / 4);
    expect(arrival.wants()).toBe(0);
    expect(arrival.step(6, CROSSFADE_MS)).toBe(0);
  });
});

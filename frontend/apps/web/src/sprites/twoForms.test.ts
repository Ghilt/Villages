import { describe, expect, it } from 'vitest';

import { WORLD_UNIT_ZOOM, pixelsPerWorldUnit } from '../geometry/cameraMath';
import {
  BECOMES_A_MARK_AT,
  CROSSFADE_MS,
  CROSSOVER_STICK,
  LONGEST_STEP_MS,
  MARK_PIXELS_PER_UNIT,
  PRESENCE_MS,
  alphasFor,
  crossoverZoom,
  easeTowards,
  formForHit,
  iconHeightOf,
  midTrade,
  sizesAt,
  wantedForm,
} from './twoForms';
import type { Form, TwoForms } from './twoForms';

/** A castle of yours: eight world units tall, and its pin far out. */
const HOUSE: TwoForms = { groundHeight: 8, marked: true };
/** Someone else's castle: the same building, and no mark. */
const THEIRS: TwoForms = { groundHeight: 8, marked: false };
/** What a candidate is: a sign and nothing else. */
const CANDIDATE: TwoForms = { marked: true, iconHeight: 26 };
/** What scenery will be: a thing and no sign for it. */
const SCENERY: TwoForms = { groundHeight: 1.5, marked: false };

/** Runs a trade to wherever it settles, as a still camera at one zoom would. */
function settle(zoom: number, forms: TwoForms, from: Form = 'icon'): number {
  let showing = from;
  let blend = from === 'ground' ? 1 : 0;
  for (let step = 0; step < 200; step += 1) {
    showing = wantedForm(zoom, forms, showing);
    blend = easeTowards(blend, showing === 'ground' ? 1 : 0, 16);
  }
  return blend;
}

describe('where the two forms cross', () => {
  it('is the one zoom, 7.5, for everything standing on the ground, whatever its size and with a mark or none', () => {
    expect(BECOMES_A_MARK_AT).toBe(7.5);
    expect(crossoverZoom(HOUSE)).toBe(BECOMES_A_MARK_AT);
    expect(crossoverZoom({ groundHeight: 3, marked: true })).toBe(BECOMES_A_MARK_AT);
    expect(crossoverZoom({ groundHeight: 12.4, marked: true })).toBe(BECOMES_A_MARK_AT);
    expect(crossoverZoom(THEIRS)).toBe(BECOMES_A_MARK_AT);
    expect(crossoverZoom(SCENERY)).toBe(BECOMES_A_MARK_AT);
  });

  it('is nowhere for a thing that is only ever a sign', () => {
    expect(crossoverZoom(CANDIDATE)).toBeNull();
    expect(crossoverZoom({ marked: true })).toBeNull();
  });

  it('gives a mark a size of its own, as tall as its thing stands in units times the same ratio for all', () => {
    expect(iconHeightOf(HOUSE)).toBeCloseTo(44, 9);
    expect(iconHeightOf({ groundHeight: 3, marked: true })).toBeCloseTo(3 * MARK_PIXELS_PER_UNIT, 9);
  });

  it('leaves a thing with no mark nothing to be drawn as far out, so it is gone there', () => {
    expect(iconHeightOf(THEIRS)).toBeNull();
    expect(sizesAt(7, THEIRS).icon).toBe(0);
    expect(settle(7, THEIRS, 'ground')).toBe(0);
    expect(settle(8, THEIRS, 'icon')).toBe(1);
    expect(sizesAt(8, THEIRS).ground).toBeCloseTo(8 * pixelsPerWorldUnit(8), 9);
  });
});

describe('every zoom the camera can rest at', () => {
  // This is the whole reason the trade is in time rather than in zoom. Fading across a band of zoom
  // left two half-drawn castles on the screen for as long as you stood inside it.
  it('settles on exactly one form, never on a blend of two', () => {
    for (let zoom = 1; zoom <= 10; zoom += 0.02) {
      expect([0, 1]).toContain(settle(zoom, HOUSE));
      expect(midTrade(settle(zoom, HOUSE))).toBe(false);
    }
  });

  it('settles the same way whichever form it came from, outside the sticky band', () => {
    const at = crossoverZoom(HOUSE) ?? 0;
    for (const zoom of [5, 7, 8, at - 0.2, at + 0.2, 9, 10]) {
      expect(settle(zoom, HOUSE, 'icon')).toBe(settle(zoom, HOUSE, 'ground'));
    }
  });

  it('holds whichever form it had while the camera sits on the crossover', () => {
    const at = crossoverZoom(HOUSE) ?? 0;

    expect(wantedForm(at, HOUSE, 'icon')).toBe('icon');
    expect(wantedForm(at, HOUSE, 'ground')).toBe('ground');
  });
});

describe('which form the camera asks for', () => {
  it('changes over once the camera is past the crossover by the sticky margin', () => {
    const at = crossoverZoom(HOUSE) ?? 0;

    expect(wantedForm(at + CROSSOVER_STICK - 0.01, HOUSE, 'icon')).toBe('icon');
    expect(wantedForm(at + CROSSOVER_STICK, HOUSE, 'icon')).toBe('ground');
    expect(wantedForm(at - CROSSOVER_STICK - 0.01, HOUSE, 'ground')).toBe('icon');
    expect(wantedForm(at - CROSSOVER_STICK + 0.01, HOUSE, 'ground')).toBe('ground');
  });

  it('is the sign at every zoom for a thing that is only ever a sign', () => {
    for (const zoom of [0, 4, 8, 10]) {
      expect(wantedForm(zoom, CANDIDATE, 'icon')).toBe('icon');
    }
  });
});

describe('how long the trade takes', () => {
  it('gets there in the time it says it does', () => {
    expect(easeTowards(0, 1, CROSSFADE_MS)).toBe(1);
    expect(easeTowards(1, 0, CROSSFADE_MS)).toBe(0);
  });

  it('never overshoots, however long a frame took', () => {
    expect(easeTowards(0, 1, CROSSFADE_MS * 40)).toBe(1);
    expect(easeTowards(1, 0, CROSSFADE_MS * 40)).toBe(0);
    expect(easeTowards(0.5, 1, 0)).toBe(0.5);
  });

  it('is only mid-trade while it is actually between the two', () => {
    expect(midTrade(0)).toBe(false);
    expect(midTrade(1)).toBe(false);
    expect(midTrade(0.5)).toBe(true);
  });
});

describe('a thing arriving, or going', () => {
  it('takes the time it says it does, which is its own and not the trade between forms', () => {
    expect(easeTowards(0, 1, PRESENCE_MS, PRESENCE_MS)).toBe(1);
    expect(easeTowards(0, 1, PRESENCE_MS / 2, PRESENCE_MS)).toBeCloseTo(0.5, 9);
    expect(easeTowards(1, 0, PRESENCE_MS, PRESENCE_MS)).toBe(0);
  });

  it('is quicker than changing into something else, because it is a smaller event', () => {
    expect(PRESENCE_MS).toBeLessThan(CROSSFADE_MS);
  });

  it('cannot be finished by one frame, however long that frame was', () => {
    // A still map draws nothing, so the gap since the last frame is often seconds. Without the cap a
    // house arriving on a still map would take its whole fade in one step, which is a pop.
    expect(LONGEST_STEP_MS).toBeLessThan(PRESENCE_MS);
    expect(LONGEST_STEP_MS).toBeLessThan(CROSSFADE_MS);
    expect(easeTowards(0, 1, LONGEST_STEP_MS, PRESENCE_MS)).toBeLessThan(1);
    expect(easeTowards(0, 1, LONGEST_STEP_MS, CROSSFADE_MS)).toBeLessThan(1);
  });

  it('runs alongside a trade rather than instead of it, so both can be part-way at once', () => {
    // A house can arrive at a zoom that also wants it to change form. The two are multiplied, so
    // neither has to wait for the other and neither can take the mark past being fully drawn.
    const presence = easeTowards(0, 1, PRESENCE_MS / 2, PRESENCE_MS);
    const { ground, icon } = alphasFor(easeTowards(0, 1, CROSSFADE_MS / 2));

    expect(ground * presence + icon * presence).toBeCloseTo(presence, 9);
    expect(ground * presence).toBeLessThanOrEqual(1);
  });
});

describe('how much of each form is drawn part-way through', () => {
  it('always adds up to one, so the mark never dims or doubles in the middle', () => {
    for (let blend = 0; blend <= 1; blend += 0.01) {
      const { ground, icon } = alphasFor(blend);
      expect(ground + icon).toBeCloseTo(1, 9);
    }
  });

  it('only ever moves one way, and is eased at both ends', () => {
    let last = -1;
    for (let blend = 0; blend <= 1; blend += 0.01) {
      const now = alphasFor(blend).ground;
      expect(now).toBeGreaterThanOrEqual(last - 1e-12);
      last = now;
    }
    expect(alphasFor(0).ground).toBe(0);
    expect(alphasFor(1).ground).toBe(1);
    // Eased: the middle moves faster than the ends.
    expect(alphasFor(0.5).ground - alphasFor(0.4).ground).toBeGreaterThan(
      alphasFor(0.1).ground - alphasFor(0).ground,
    );
  });
});

describe('what each form is measured in', () => {
  it('gives the ground form twice the height for every zoom level in', () => {
    for (const zoom of [6, 7, 8, 9]) {
      expect(sizesAt(zoom + 1, SCENERY).ground).toBeCloseTo(sizesAt(zoom, SCENERY).ground * 2, 9);
    }
  });

  it('measures the ground form in world units, so it sits on the terrain', () => {
    expect(sizesAt(9, SCENERY).ground).toBeCloseTo(1.5 * pixelsPerWorldUnit(9), 9);
    expect(pixelsPerWorldUnit(WORLD_UNIT_ZOOM)).toBeCloseTo(1, 9);
  });

  it('keeps an icon the same size whatever the camera does', () => {
    for (const zoom of [0, 3, 6, 8, 10]) {
      expect(sizesAt(zoom, CANDIDATE).icon).toBe(26);
      expect(sizesAt(zoom, CANDIDATE).ground).toBe(0);
    }
  });
});

describe('which form answers a click', () => {
  it('is whichever one is more of the two, so there is never an invisible target', () => {
    expect(formForHit(0)).toBe('icon');
    expect(formForHit(0.49)).toBe('icon');
    expect(formForHit(0.5)).toBe('ground');
    expect(formForHit(1)).toBe('ground');
  });
});

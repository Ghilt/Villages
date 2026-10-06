import { describe, expect, it } from 'vitest';

import { glidesOnTheRail, msOf, type Placed } from './railGlide';

const GAP = 10;

/** Windows stacked from the rail's top, each as tall as given, with the gap between them. */
function stack(...windows: [string, number][]): Placed[] {
  let top = 0;
  return windows.map(([id, h]) => {
    const placed = { id, top, h };
    top += h + GAP;
    return placed;
  });
}

/** Where each window stands at the start of its glide: where the flow puts it, plus its shift. */
function startOf(before: Placed[], after: Placed[]): Record<string, { top: number; h: number }> {
  const glides = new Map(glidesOnTheRail(before, after, GAP).map((one) => [one.id, one]));
  const start: Record<string, { top: number; h: number }> = {};
  let flow = after[0]?.top ?? 0;
  for (const now of after) {
    const glide = glides.get(now.id);
    const h = glide?.fromH ?? now.h;
    start[now.id] = { top: flow + (glide?.shift ?? 0), h };
    flow += h + GAP;
  }
  return start;
}

/**
 * The windows on the rail glide from where they stood to where they stand. What matters is that at the start of
 * the glide every window that was there is exactly where it was: the shift makes up whatever the flow does not.
 */
describe('the windows on the rail gliding', () => {
  it('grows a window opened to its new height, and slides the one under it down with it', () => {
    const before = stack(['a', 44], ['b', 200]);
    const after = stack(['a', 300], ['b', 200]);

    expect(glidesOnTheRail(before, after, GAP)).toEqual([
      { id: 'a', fromH: 44, toH: 300, shift: 0, arriving: false },
    ]);
    expect(startOf(before, after).b?.top).toBe(before[1]?.top);
  });

  it('grows a window arriving at the top in from nothing, and starts the rest where they were', () => {
    const before = stack(['a', 200], ['b', 44]);
    const after = stack(['new', 250], ['a', 200], ['b', 44]);
    const start = startOf(before, after);

    expect(glidesOnTheRail(before, after, GAP)[0]).toMatchObject({ id: 'new', fromH: 0, arriving: true });
    expect(start.a?.top).toBe(before[0]?.top);
    expect(start.b?.top).toBe(before[1]?.top);
  });

  it('slides the rest up into the room of one closed, from exactly where they stood', () => {
    const before = stack(['a', 200], ['b', 120], ['c', 44]);
    const after = stack(['a', 200], ['c', 44]);

    expect(startOf(before, after).c?.top).toBe(before[2]?.top);
    expect(glidesOnTheRail(before, after, GAP).map((one) => one.id)).toEqual(['c']);
  });

  // Opening a window put away brings it to the top of the rail, so the order changes as well as the heights.
  it('carries a window brought to the top from where it stood, and the others down from theirs', () => {
    const before = stack(['a', 200], ['b', 44]);
    const after = stack(['b', 260], ['a', 200]);
    const start = startOf(before, after);

    expect(start.b).toEqual({ top: before[1]?.top, h: 44 });
    expect(start.a).toEqual({ top: before[0]?.top, h: 200 });
  });

  it('has nothing to glide when nothing moved', () => {
    const placed = stack(['a', 200], ['b', 44]);

    expect(glidesOnTheRail(placed, placed, GAP)).toEqual([]);
  });
});

describe('msOf', () => {
  it('reads a CSS time in either unit, and anything else as nought', () => {
    expect(msOf('160ms')).toBe(160);
    expect(msOf(' 0.16s')).toBe(160);
    expect(msOf('0s')).toBe(0);
    expect(msOf('')).toBe(0);
    expect(msOf('fast')).toBe(0);
  });
});

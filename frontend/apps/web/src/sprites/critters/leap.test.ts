import { describe, expect, it } from 'vitest';

import { posesOf, ringsOf } from './critterClock';
import { anHour, wood } from './critterTestWorld';
import { CRITTERS_LOOK } from './look';

describe('the leap', () => {
  it('leaps a fish out of a lake, a river or the shallow sea, and never out of the land', () => {
    for (const water of ['lake', 'river', 'shallow-sea']) {
      // The shallow sea's dolphins and gulls are the sea's own: see sea.test.ts.
      const fish = [...anHour(1, wood({ coverIn: () => [] }, 'oak', water), 600).values()].filter(
        (event) => event.kind !== 'dolphin' && event.kind !== 'gull',
      );
      expect(fish.length).toBeGreaterThan(0);
      expect(fish.every((event) => event.kind === 'fish' && event.behaviour === 'leap')).toBe(true);
    }
    expect([...anHour(1).values()].some((event) => event.kind === 'fish')).toBe(false);
    // Where half the cells are a lake and half a wood, every fish leaps from the lake.
    const shore = CRITTERS_LOOK.cell * 2020;
    const half = [
      ...anHour(1, wood({ classAt: (x) => (x < shore ? 'lake' : 'mixed-forest') }), 600).values(),
    ];
    const fish = half.filter((event) => event.kind === 'fish');
    expect(fish.length).toBeGreaterThan(0);
    expect(fish.every((event) => event.from.x < shore)).toBe(true);
    expect(anHour(1, wood({ sees: () => false }, 'oak', 'lake'), 600).size).toBe(0);
  });

  it('leaps clear across the screen and falls back, nose up and then down, its tail flicking, never popping', () => {
    const P = CRITTERS_LOOK.leap;
    const leaps = [...anHour(1, wood({ coverIn: () => [] }, 'oak', 'lake'), 600).values()].slice(0, 20);
    for (const event of leaps) {
      const fish = event.animals[0]!;
      // East or west, a little either way, so it is seen from the side.
      expect(Math.abs(Math.sin(fish.heading))).toBeLessThan(Math.sin(0.31));
      const air = fish.seconds - P.ring.seconds;
      let was: ReturnType<typeof posesOf>[number] | null = null;
      const frames = new Set<number>();
      let highest = 0;
      for (let at = 1 / 60; at < fish.seconds; at += 1 / 60) {
        const pose = posesOf(event, event.startsAt + at, 2)[0]!;
        if (was !== null) {
          expect(Math.abs(pose.alpha - was.alpha)).toBeLessThan(0.4);
          expect(Math.hypot(pose.x - was.x, pose.y - was.y)).toBeLessThan(0.5);
          expect(Math.abs(pose.height - was.height)).toBeLessThan(0.2);
        }
        if (at < air * 0.4) expect(pose.tilt!).toBeGreaterThan(0);
        if (at > air * 0.6 && at < air) expect(pose.tilt!).toBeLessThan(0);
        if (at >= air) expect(pose.alpha).toBe(0);
        frames.add(pose.frame);
        highest = Math.max(highest, pose.height);
        was = pose;
      }
      expect(highest).toBeGreaterThanOrEqual(P.high[0] * 0.95);
      expect(highest).toBeLessThanOrEqual(P.high[1]);
      expect([...frames].sort()).toEqual([0, 1]);
    }
  });

  it('leaves a ring spreading where a fish left the water and one where it fell, and nothing else does', () => {
    const P = CRITTERS_LOOK.leap;
    const leaps = [...anHour(1, wood({ coverIn: () => [] }, 'oak', 'lake'), 600).values()].slice(0, 20);
    for (const event of leaps) {
      const fish = event.animals[0]!;
      const air = fish.seconds - P.ring.seconds;
      const left = ringsOf(event, event.startsAt + 0.3);
      expect(left.length).toBe(1);
      expect(Math.hypot(left[0]!.x - event.from.x, left[0]!.y - event.from.y)).toBe(0);
      // A moment after it fell, the first ring is still spreading, and the second has begun where it fell.
      const fell = ringsOf(event, event.startsAt + air + 0.3);
      expect(fell.length).toBe(2);
      expect(fell[1]!.radius).toBeLessThan(fell[0]!.radius);
      const far = Math.hypot(fell[1]!.x - event.from.x, fell[1]!.y - event.from.y);
      expect(far).toBeGreaterThanOrEqual(P.reach[0] - 1e-9);
      expect(far).toBeLessThanOrEqual(P.reach[1] + 1e-9);
      // A ring comes and goes without a pop, and is gone by the time the leap is over.
      // Each ring by where it is: one there both moments changes a little, and one there only one of them is faint.
      const byPlace = (seconds: number) =>
        new Map(ringsOf(event, event.startsAt + seconds).map((ring) => [`${ring.x},${ring.y}`, ring.alpha]));
      let was = byPlace(0);
      for (let at = 1 / 60; at < fish.seconds + 0.2; at += 1 / 60) {
        const now = byPlace(at);
        for (const place of new Set([...now.keys(), ...was.keys()])) {
          const [before, after] = [was.get(place), now.get(place)];
          if (before !== undefined && after !== undefined) expect(Math.abs(after - before)).toBeLessThan(0.2);
          else expect(before ?? after!).toBeLessThan(0.2);
        }
        was = now;
      }
      expect(ringsOf(event, event.startsAt + fish.seconds + 0.01)).toEqual([]);
    }
    expect([...anHour(1).values()].every((event) => ringsOf(event, event.startsAt + 0.5).length === 0)).toBe(
      true,
    );
  });
});

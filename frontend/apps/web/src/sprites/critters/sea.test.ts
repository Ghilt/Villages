import { describe, expect, it } from 'vitest';

import { lastsFor, posesOf, ringsOf } from './critterClock';
import { anHour, wood } from './critterTestWorld';
import { CRITTERS_LOOK } from './look';
import type { CritterEvent } from './types';

const L = CRITTERS_LOOK;

/** The open water of the class said, the house seeing all of it. */
const water = (land: string) => wood({ coverIn: () => [] }, 'oak', land);

/** Where every animal of a critter is at so many moments over the whole of it. */
const posesOver = (event: CritterEvent, steps = 300) =>
  Array.from({ length: steps }, (_, at) => {
    const seconds = event.startsAt + ((at + 0.5) / steps) * lastsFor(event);
    return posesOf(event, seconds, 3, L.kinds[event.kind]!.size);
  });

const ofKind = (events: Iterable<CritterEvent>, kind: string) =>
  [...events].filter((event) => event.kind === kind);

describe('the sea', () => {
  it('wheels gulls low and quick over the shallow sea, two to four together, and never over the land', () => {
    const G = L.soar.kinds.gull!;
    const gulls = ofKind(anHour(1, water('shallow-sea'), 900).values(), 'gull');
    expect(gulls.length).toBeGreaterThan(3);
    for (const event of gulls) {
      expect(event.behaviour).toBe('soar');
      expect(event.animals.length).toBeGreaterThanOrEqual(2);
      expect(event.animals.length).toBeLessThanOrEqual(4);
      const heights = posesOver(event).flatMap((poses) => poses.map((pose) => pose.height));
      // Lower than a hawk ever circles, and round a circle quicker than a hawk's.
      expect(Math.max(...heights)).toBeLessThan(L.soar.high[0]);
      expect(G.circleSeconds!).toBeLessThan(L.soar.circleSeconds);
    }
    for (const land of ['meadow', 'farmland', 'lake', 'mixed-forest']) {
      expect(ofKind(anHour(1, water(land), 600).values(), 'gull')).toEqual([]);
    }
  });

  it('leaps dolphins in a row, one after another along the same way, never popping', () => {
    const D = L.leap.kinds.dolphin!;
    const pods = ofKind(anHour(1, water('shallow-sea'), 900).values(), 'dolphin');
    expect(pods.length).toBeGreaterThan(3);
    for (const pod of pods) {
      expect(pod.behaviour).toBe('leap');
      expect(pod.animals.length).toBeGreaterThanOrEqual(D.pod![0]);
      expect(pod.animals.length).toBeLessThanOrEqual(D.pod![1]);
      const [first, ...rest] = pod.animals;
      rest.forEach((one, at) => {
        // Each later than the one before it, behind it along the way they go.
        expect(one.delay).toBeGreaterThan(at === 0 ? 0 : rest[at - 1]!.delay - D.after! * 0.5);
        const behind = -(Math.cos(first!.heading) * one.nudge!.x + Math.sin(first!.heading) * one.nudge!.y);
        expect(behind).toBeCloseTo(D.apart! * (at + 1), 5);
        expect(Math.abs(one.heading - first!.heading)).toBeLessThan(0.11);
      });
      // Each comes clear of the water within a moment and goes back into it, and leaves its rings.
      const first0 = posesOf(pod, pod.startsAt + 0.01, 2)[0];
      expect(first0?.alpha ?? 0).toBeLessThan(0.15);
      const rings = Array.from({ length: 60 }, (_, at) =>
        ringsOf(pod, pod.startsAt + (at / 60) * lastsFor(pod)),
      ).flat();
      expect(rings.length).toBeGreaterThan(0);
    }
  });

  it('blows a whale far out on the ocean now and then, in one place, a wide ring as it goes under, and nowhere else', () => {
    const W = L.leap.kinds.whale!;
    const ocean = [...anHour(1, water('ocean'), 1800).values()];
    expect(ocean.length).toBeGreaterThan(0);
    expect(ocean.every((event) => event.kind === 'whale' && event.behaviour === 'leap')).toBe(true);
    // Now and then: far fewer than a lake's fish over the same water and the same time.
    const fish = ofKind(anHour(1, water('lake'), 1800).values(), 'fish');
    expect(ocean.length).toBeLessThan(fish.length * 0.25);
    for (const whale of ocean.slice(0, 10)) {
      const poses = posesOver(whale).flat();
      // In one place, on the water, its frames played through once, and coming and going slowly.
      expect(new Set(poses.map((pose) => `${pose.x.toFixed(6)} ${pose.y.toFixed(6)}`)).size).toBe(1);
      expect(poses.every((pose) => pose.height === 0)).toBe(true);
      const shown = poses.filter((pose) => pose.alpha > 0);
      expect(shown.map((pose) => pose.frame)).toEqual([...shown.map((pose) => pose.frame)].sort());
      expect(new Set(shown.map((pose) => pose.frame))).toEqual(new Set([0, 1, 2]));
      expect(posesOf(whale, whale.startsAt + W.fade! * 0.2, 3)[0]!.alpha).toBeLessThan(0.3);
      const rings = Array.from({ length: 80 }, (_, at) =>
        ringsOf(whale, whale.startsAt + (at / 80) * lastsFor(whale)),
      ).flat();
      expect(rings.length).toBeGreaterThan(0);
      expect(Math.max(...rings.map((ring) => ring.radius))).toBeGreaterThan(L.leap.ring.to * 1.5);
    }
    for (const land of ['shallow-sea', 'lake', 'river']) {
      expect(ofKind(anHour(1, water(land), 900).values(), 'whale')).toEqual([]);
    }
  });
});

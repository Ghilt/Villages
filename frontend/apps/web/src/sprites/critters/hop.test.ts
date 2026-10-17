import { describe, expect, it } from 'vitest';

import { lastsFor, posesOf } from './critterClock';
import { anHour, wood } from './critterTestWorld';
import { CRITTERS_LOOK } from './look';

describe('the hop', () => {
  it('sends a squirrel bounding from one tree to another near it, low over the ground, and behind it', () => {
    const H = CRITTERS_LOOK.hop.squirrel!;
    const squirrels = [...anHour(1).values()].filter((event) => event.kind === 'squirrel').slice(0, 30);
    expect(squirrels.length).toBeGreaterThan(10);
    for (const event of squirrels) {
      expect(event.animals.length).toBe(1);
      const to = event.animals[0]!.to!;
      const away = Math.hypot(to.x - event.from.x, to.y - event.from.y);
      expect(away).toBeGreaterThanOrEqual(H.reach[0]);
      expect(away).toBeLessThanOrEqual(H.reach[1]);
      const poses = Array.from({ length: 200 }, (_, at) =>
        posesOf(event, event.startsAt + ((at + 0.5) / 200) * lastsFor(event), 3),
      ).flat();
      // Never higher than a bound takes it, down on the ground between bounds, and never far off its way.
      expect(Math.max(...poses.map((pose) => pose.height))).toBeLessThanOrEqual(H.high + 1e-9);
      expect(poses.some((pose) => pose.height < 0.02 && pose.alpha > 0.5)).toBe(true);
      const off = (pose: { x: number; y: number }) =>
        Math.abs(
          (pose.x - event.from.x) * (to.y - event.from.y) - (pose.y - event.from.y) * (to.x - event.from.x),
        ) / away;
      expect(Math.max(...poses.map(off))).toBeLessThan(away * 0.1 + 1e-9);
      expect(new Set(poses.map((pose) => pose.frame))).toEqual(new Set([0, 1, 2]));
    }
  });

  it('stops a hopping animal once on its way, sitting still, and then it goes on', () => {
    const event = [...anHour(1).values()].find((one) => one.kind === 'squirrel')!;
    const H = CRITTERS_LOOK.hop.squirrel!;
    const step = 0.02;
    let still = 0;
    let longest = 0;
    let was: { x: number; y: number } | null = null;
    for (let at = event.startsAt + step; at < event.startsAt + lastsFor(event); at += step) {
      const pose = posesOf(event, at, 3)[0]!;
      const sits = was !== null && Math.hypot(pose.x - was.x, pose.y - was.y) < 1e-9 && pose.height === 0;
      still = sits ? still + step : 0;
      longest = Math.max(longest, still);
      was = pose;
    }
    expect(longest).toBeGreaterThan(H.pause * 0.8);
    expect(longest).toBeLessThan(H.pause + step);
  });

  it('brings a hare out from behind a bush or a tuft on grassland, and a squirrel only in the woods', () => {
    // The hawks circling over it come out of no cover, and are the soar's.
    const meadow = [...anHour(1, wood({}, 'grass', 'meadow', 3), 600).values()].filter(
      (event) => event.kind !== 'hawk',
    );
    expect(meadow.length).toBeGreaterThan(0);
    expect(meadow.every((event) => event.kind === 'hare' && event.behaviour === 'hop')).toBe(true);
    // Neither comes out of what it does not live in: no hare in a wood of tufts, no squirrel among a meadow's oaks.
    expect(anHour(1, wood({}, 'grass', 'mixed-forest', 3), 600).size).toBe(0);
    const oaks = [...anHour(1, wood({}, 'oak', 'meadow'), 600).values()].filter(
      (event) => event.kind !== 'hawk',
    );
    expect(oaks.length).toBeGreaterThan(0);
    expect(oaks.every((event) => event.kind === 'songbird')).toBe(true);
  });

  it('brings no hare where there is no cover near enough to run to', () => {
    const far = [...anHour(1, wood({}, 'grass', 'meadow', 40), 600).values()];
    expect(far.filter((event) => event.kind === 'hare')).toEqual([]);
  });
});

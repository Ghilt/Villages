import { describe, expect, it } from 'vitest';

import { DOWN_WIND } from '../wind';
import { lastsFor, posesOf } from './critterClock';
import { anHour, wood } from './critterTestWorld';
import { CRITTERS_LOOK } from './look';

/** Open ground of the class said with nothing standing on it, the house seeing all of it. */
const open = (land: string) => wood({ coverIn: () => [] }, 'oak', land);

describe('the soar', () => {
  it('circles a hawk high over open ground, rock and desert, and never over a wood or the water', () => {
    for (const land of ['meadow', 'steppe', 'farmland', 'bare-rock', 'desert-sand']) {
      const hawks = [...anHour(1, open(land), 600).values()];
      expect(hawks.length).toBeGreaterThan(0);
      expect(hawks.every((event) => event.kind === 'hawk' && event.behaviour === 'soar')).toBe(true);
    }
    expect(anHour(1, open('mixed-forest'), 600).size).toBe(0);
    expect([...anHour(1, open('lake'), 600).values()].every((event) => event.kind === 'fish')).toBe(true);
  });

  it('goes round its circle high and slow, drifting down the wind, turned the way it flies, and never pops', () => {
    const S = CRITTERS_LOOK.soar;
    const hawks = [...anHour(1, open('meadow'), 600).values()].slice(0, 10);
    for (const event of hawks) {
      const bird = event.animals[0]!;
      expect(lastsFor(event)).toBeGreaterThanOrEqual(S.seconds[0]);
      expect(lastsFor(event)).toBeLessThanOrEqual(S.seconds[1]);
      const radius = S.radius[0] + (S.radius[1] - S.radius[0]) * bird.reach;
      const step = 1 / 30;
      let was: ReturnType<typeof posesOf>[number] | null = null;
      const frames = new Set<number>();
      for (let at = step; at < bird.seconds; at += step) {
        const pose = posesOf(event, event.startsAt + at, 2)[0]!;
        // On its circle about a middle that drifts down the wind, high up.
        const middle = {
          x: event.from.x + DOWN_WIND.east * S.drift * at,
          y: event.from.y + DOWN_WIND.south * S.drift * at,
        };
        expect(Math.abs(Math.hypot(pose.x - middle.x, pose.y - middle.y) - radius)).toBeLessThan(1e-6);
        expect(pose.height).toBeGreaterThanOrEqual(S.high[0] - 0.4);
        expect(pose.height).toBeLessThanOrEqual(S.high[1] + 0.4);
        if (was !== null) {
          // Turned the way it is going, and slowly: no jump, no sudden fade.
          const going = Math.atan2(pose.y - was.y, pose.x - was.x);
          const off = Math.atan2(Math.sin(going - pose.heading!), Math.cos(going - pose.heading!));
          expect(Math.abs(off)).toBeLessThan(0.2);
          expect(Math.hypot(pose.x - was.x, pose.y - was.y)).toBeLessThan(0.15);
          expect(Math.abs(pose.alpha - was.alpha)).toBeLessThan(0.05);
        }
        frames.add(pose.frame);
        was = pose;
      }
      expect(posesOf(event, event.startsAt + 0.05, 2)[0]!.alpha).toBeLessThan(0.05);
      expect(posesOf(event, event.startsAt + bird.seconds - 0.05, 2)[0]!.alpha).toBeLessThan(0.05);
      expect(frames.has(0)).toBe(true);
    }
  });
});

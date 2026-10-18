import { describe, expect, it } from 'vitest';

import { lastsFor, posesOf, ringsOf } from './critterClock';
import { anHour, wood } from './critterTestWorld';
import { CRITTERS_LOOK } from './look';

const L = CRITTERS_LOOK;
/** A lake to the west of this line, in world units east, and a meadow of tufts three apart to the east of it. */
const SHORE = 16100;
const meadow = wood({}, 'grass', 'meadow', 3);
const byALake = wood({
  coverIn: (fromX, fromY, toX, toY) =>
    meadow.coverIn(Math.max(fromX, SHORE), fromY, Math.max(toX, SHORE), toY),
  classAt: (x) => (x < SHORE ? 'lake' : 'meadow'),
});

/** Where a critter is over the whole of it, at so many moments. */
const posesOver = (event: Parameters<typeof posesOf>[0], steps = 400) =>
  Array.from({ length: steps }, (_, at) =>
    posesOf(event, event.startsAt + ((at + 0.5) / steps) * lastsFor(event), 3),
  ).flat();

describe('the wet land', () => {
  it('brings frogs hopping from reed to reed in a marsh, and snakes gliding through them, and nothing else', () => {
    const marsh = [...anHour(1, wood({}, 'reed', 'marsh', 1.5), 900).values()];
    const frogs = marsh.filter((event) => event.kind === 'frog');
    const snakes = marsh.filter((event) => event.kind === 'snake');
    expect(frogs.length).toBeGreaterThan(10);
    expect(snakes.length).toBeGreaterThan(3);
    expect(frogs.length + snakes.length).toBe(marsh.length);
    expect(frogs.every((event) => event.behaviour === 'hop' && event.animals[0]!.to!.kind === 'reed')).toBe(
      true,
    );
    expect(snakes.every((event) => event.behaviour === 'slither')).toBe(true);
  });

  it('glides a snake low along its way to the next tuft, never popping in or out, waving as it goes', () => {
    const S = L.slither;
    const snakes = [...anHour(1, wood({}, 'reed', 'marsh', 1.5), 900).values()]
      .filter((event) => event.kind === 'snake')
      .slice(0, 12);
    for (const event of snakes) {
      const to = event.animals[0]!.to!;
      const away = Math.hypot(to.x - event.from.x, to.y - event.from.y);
      expect(away).toBeGreaterThanOrEqual(S.reach[0]);
      expect(away).toBeLessThanOrEqual(S.reach[1]);
      const poses = posesOver(event);
      // Out of its cover and into the next, faint at both ends, whole between.
      expect(poses[0]!.alpha).toBeLessThan(0.1);
      expect(poses.at(-1)!.alpha).toBeLessThan(0.1);
      expect(Math.max(...poses.map((pose) => pose.alpha))).toBe(1);
      expect(poses.every((pose) => pose.height === 0 && pose.heading !== undefined)).toBe(true);
      // Never a jump from one moment to the next, and never far off its way.
      const step = lastsFor(event) / poses.length;
      for (let at = 1; at < poses.length; at += 1) {
        const moved = Math.hypot(poses[at]!.x - poses[at - 1]!.x, poses[at]!.y - poses[at - 1]!.y);
        expect(moved).toBeLessThan(S.speed * step * 2);
      }
      const off = (pose: { x: number; y: number }) =>
        Math.abs(
          (pose.x - event.from.x) * (to.y - event.from.y) - (pose.y - event.from.y) * (to.x - event.from.x),
        ) / away;
      expect(Math.max(...poses.map(off))).toBeLessThan(away * 0.1 + S.sway + 1e-9);
      expect(new Set(poses.map((pose) => pose.frame))).toEqual(new Set([0, 1, 2]));
    }
  });

  it('brings a frog out of the tufts beside any lake, whatever the ground, into the water with a ring', () => {
    const [, most] = L.hop.frog!.water!;
    const events = [...anHour(1, byALake, 1800).values()];
    const frogs = events.filter((event) => event.kind === 'frog');
    expect(frogs.length).toBeGreaterThan(3);
    for (const event of frogs) {
      // Only out of a tuft near enough to the water, and into it.
      expect(event.from.x - SHORE).toBeLessThanOrEqual(most + 1e-9);
      const to = event.animals[0]!.to!;
      expect(to.kind).toBe('lake');
      expect(to.x).toBeLessThan(SHORE);
      // Gone into the water, and a ring spreading where it went.
      const end = event.startsAt + lastsFor(event);
      expect(posesOf(event, end - 0.05, 3)[0]?.alpha ?? 0).toBe(0);
      const rings = Array.from({ length: 40 }, (_, at) => ringsOf(event, end - (at / 40) * 2)).flat();
      expect(rings.length).toBeGreaterThan(0);
      expect(rings.every((ring) => Math.hypot(ring.x - to.x, ring.y - to.y) < 1e-9)).toBe(true);
    }
    // Away from the water the meadow's own cast comes out, and no frog.
    const inland = [...anHour(1, meadow, 1800).values()];
    expect(inland.length).toBeGreaterThan(0);
    expect(inland.filter((event) => event.kind === 'frog')).toEqual([]);
  });
});

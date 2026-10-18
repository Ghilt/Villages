import { describe, expect, it } from 'vitest';

import { lastsFor, posesOf } from './critterClock';
import { anHour, wood } from './critterTestWorld';
import { CRITTERS_LOOK } from './look';
import { spawnedAt } from './spawned';
import type { CritterEvent } from './types';

const L = CRITTERS_LOOK;

/** Open ground of the class said with nothing standing on it, the house seeing all of it. */
const open = (land: string) => wood({ coverIn: () => [] }, 'oak', land);

const ofKind = (events: Iterable<CritterEvent>, kind: string) =>
  [...events].filter((event) => event.kind === kind);

/** Where a critter's one animal is at so many moments over the whole of it. */
const posesOver = (event: CritterEvent, steps = 200) =>
  Array.from({ length: steps }, (_, at) =>
    posesOf(event, event.startsAt + ((at + 0.5) / steps) * lastsFor(event), 3),
  ).flat();

describe('the dry and the high ground', () => {
  it('dashes a lizard over the open sand where nothing stands, low and flat, and from stone to stone in the stony desert', () => {
    const sand = ofKind(anHour(1, open('desert-sand'), 1200).values(), 'lizard');
    expect(sand.length).toBeGreaterThan(5);
    const [least, most] = L.hop.lizard!.reach;
    for (const event of sand) {
      expect(event.behaviour).toBe('hop');
      const to = event.animals[0]!.to!;
      expect(to.kind).toBe('desert-sand');
      const away = Math.hypot(to.x - event.from.x, to.y - event.from.y);
      expect(away).toBeGreaterThanOrEqual(least - 1e-9);
      expect(away).toBeLessThanOrEqual(most + 1e-9);
      const poses = posesOver(event);
      expect(Math.max(...poses.map((pose) => pose.height))).toBeLessThan(0.05);
      // On the open sand it comes and goes softly, as nothing hides it.
      expect(posesOf(event, event.startsAt + 0.05, 3)[0]!.alpha).toBeLessThan(0.2);
    }
    const stony = ofKind(anHour(1, wood({}, 'boulder', 'desert-stone', 2), 1200).values(), 'lizard');
    expect(stony.length).toBeGreaterThan(5);
    expect(
      stony.every((event) => event.from.kind === 'boulder' && event.animals[0]!.to!.kind === 'boulder'),
    ).toBe(true);
  });

  it('keeps a lizard on its own ground: none dashes off the sand into the sea', () => {
    const shore = L.cell * 2020;
    const beach = wood({ coverIn: () => [], classAt: (x) => (x < shore ? 'shallow-sea' : 'desert-sand') });
    const lizards = ofKind(anHour(1, beach, 1800).values(), 'lizard');
    expect(lizards.length).toBeGreaterThan(5);
    expect(lizards.every((event) => event.animals[0]!.to!.x >= shore)).toBe(true);
  });

  it('lopes a marmot from boulder to boulder of the high ground, sitting up on the way', () => {
    const rock = ofKind(anHour(1, wood({}, 'boulder', 'bare-rock', 2), 1200).values(), 'marmot');
    expect(rock.length).toBeGreaterThan(5);
    for (const event of rock) {
      expect(event.from.kind).toBe('boulder');
      expect(event.animals[0]!.to!.kind).toBe('boulder');
      // It sits still once on its way, on its still frame, sitting up.
      const frames = posesOver(event, 400).map((pose) => pose.frame);
      expect(frames).toContain(L.hop.marmot!.frames.still);
    }
  });

  it('bounds an arctic hare over the open snow, and out of the heather of the tundra', () => {
    const snow = ofKind(anHour(1, open('ice'), 1800).values(), 'arctic-hare');
    expect(snow.length).toBeGreaterThan(3);
    expect(snow.every((event) => event.from.kind === 'ice' && event.animals[0]!.to!.kind === 'ice')).toBe(
      true,
    );
    const tundra = ofKind(anHour(1, wood({}, 'heather', 'tundra', 2), 1200).values(), 'arctic-hare');
    expect(tundra.length).toBeGreaterThan(3);
    expect(tundra.every((event) => event.from.kind === 'heather')).toBe(true);
  });

  it('circles vultures one to three together and an eagle alone, high and slow', () => {
    const vultures = ofKind(anHour(1, open('desert-sand'), 1800).values(), 'vulture');
    expect(vultures.length).toBeGreaterThan(0);
    expect(vultures.every((event) => event.animals.length >= 1 && event.animals.length <= 3)).toBe(true);
    const eagles = ofKind(anHour(1, open('bare-rock'), 1800).values(), 'eagle');
    expect(eagles.length).toBeGreaterThan(0);
    expect(eagles.every((event) => event.animals.length === 1)).toBe(true);
    const lowest = Math.min(
      ...eagles.slice(0, 5).flatMap((event) => posesOver(event).map((pose) => pose.height)),
    );
    expect(lowest).toBeGreaterThan(L.soar.high[0]);
  });

  it('puts a lizard on the open sand clicked, and says why not where it would run off it', () => {
    const at = { id: 1, kind: 'lizard', x: 16200.5, y: 8100.5, at: 1000 };
    const made = spawnedAt(at, 1000, open('desert-sand'));
    expect(typeof made).toBe('object');
    expect((made as CritterEvent).animals[0]!.to!.kind).toBe('desert-sand');
    const islet = wood({
      coverIn: () => [],
      classAt: (x, y) => (Math.hypot(x - at.x, y - at.y) < 0.5 ? 'desert-sand' : 'ocean'),
    });
    expect(typeof spawnedAt(at, 1000, islet)).toBe('string');
  });
});

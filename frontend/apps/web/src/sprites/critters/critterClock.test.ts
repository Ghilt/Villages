import { describe, expect, it } from 'vitest';

import { CASTS } from './casts';
import { eventIn, eventsAt, lastsFor, posesOf, slotOf } from './critterClock';
import type { Cover, CritterEvent, Ground } from './critterClock';
import { CRITTERS_LOOK } from './look';

/** A wood of oaks two world units apart, the house seeing all of it, unless told otherwise. */
function wood(change: Partial<Ground> = {}, kind = 'oak', land = 'mixed-forest'): Ground {
  return {
    coverIn(fromX, fromY, toX, toY) {
      const cover: Cover[] = [];
      for (let y = Math.ceil(fromY / 2) * 2; y < toY; y += 2) {
        for (let x = Math.ceil(fromX / 2) * 2; x < toX; x += 2)
          cover.push({ x: x + 0.3, y: y + 0.7, kind, height: 4 });
      }
      return cover;
    },
    classAt: () => land,
    sees: () => true,
    ...change,
  };
}

const CELLS = { fromX: 2000, toX: 2040, fromY: 1000, toY: 1030 };
/** An afternoon of 2026, in seconds of the wall clock. */
const NOW = Date.UTC(2026, 9, 16, 15, 0, 0) / 1000;

/** Every critter of the cells over an hour, by its key. */
function anHour(density: number, ground = wood()): Map<string, CritterEvent> {
  const events = new Map<string, CritterEvent>();
  for (let slot = slotOf(NOW); slot < slotOf(NOW + 3600); slot += 1) {
    for (let cellY = CELLS.fromY; cellY <= CELLS.toY; cellY += 1) {
      for (let cellX = CELLS.fromX; cellX <= CELLS.toX; cellX += 1) {
        const event = eventIn(cellX, cellY, slot, density, ground);
        if (event !== null) events.set(event.key, event);
      }
    }
  }
  return events;
}

describe("the critters' clock", () => {
  it('brings birds out of the wood every so often', () => {
    const events = anHour(CRITTERS_LOOK.density);
    // About one cell's slot in fifty at the fullest density, so at the usual one a few hundred flocks an hour here.
    expect(events.size).toBeGreaterThan(100);
    expect([...events.values()].every((event) => event.kind === 'songbird')).toBe(true);
  });

  it('is the same in every browser: the same critters from the same place and the same moment', () => {
    expect(JSON.stringify(eventsAt(CELLS, NOW + 100, 0.5, wood()))).toBe(
      JSON.stringify(eventsAt(CELLS, NOW + 100, 0.5, wood())),
    );
  });

  it('is the same critter however the view is cut into cells to ask', () => {
    const whole = eventsAt(CELLS, NOW + 200, 1, wood());
    const half = eventsAt({ ...CELLS, toX: 2020 }, NOW + 200, 1, wood());
    expect(half.length).toBeGreaterThan(0);
    for (const event of half) {
      expect(whole.find((one) => one.key === event.key)).toEqual(event);
    }
  });

  it('only takes critters away when the density goes down: fewer is a subset of more', () => {
    const few = anHour(0.3);
    const many = anHour(0.7);
    expect(few.size).toBeLessThan(many.size);
    for (const [key, event] of few) expect(many.get(key)).toEqual(event);
    expect(anHour(0).size).toBe(0);
    expect(eventsAt(CELLS, NOW, 0, wood())).toEqual([]);
  });

  it('brings a critter only where its kind lives and out of what it comes out of', () => {
    expect(anHour(1, wood({}, 'boulder')).size).toBe(0);
    expect(anHour(1, wood({}, 'oak', 'ocean')).size).toBe(0);
    expect(anHour(1, wood({ classAt: () => null })).size).toBe(0);
    for (const land of Object.keys(CASTS)) expect(anHour(1, wood({}, 'oak', land)).size).toBeGreaterThan(0);
  });

  it('brings nothing where the house does not see now, nor where the scenery is not yet known', () => {
    expect(anHour(1, wood({ sees: () => false })).size).toBe(0);
    expect(anHour(1, wood({ coverIn: () => null })).size).toBe(0);
    // Half the wood seen: every bird leaves from the half that is.
    const half = anHour(1, wood({ sees: (x) => x < 2020 * CRITTERS_LOOK.cell }));
    expect(half.size).toBeGreaterThan(0);
    expect([...half.values()].every((event) => event.from.x < 2020 * CRITTERS_LOOK.cell)).toBe(true);
  });

  it('never pops: a bird comes out of its cover and fades away, and never jumps', () => {
    const events = [...anHour(1).values()].slice(0, 40);
    const step = 1 / 60;
    for (const event of events) {
      let was: ReturnType<typeof posesOf> | null = null;
      for (let at = event.startsAt - 0.5; at < event.startsAt + lastsFor(event) + 0.5; at += step) {
        const poses = posesOf(event, at, 3);
        // A bird appears and goes only at nought alpha, so the count changes only where nothing shows.
        if (was !== null && poses.length === was.length) {
          poses.forEach((pose, i) => {
            const before = was![i]!;
            expect(Math.abs(pose.alpha - before.alpha)).toBeLessThan(0.4);
            expect(Math.hypot(pose.x - before.x, pose.y - before.y)).toBeLessThan(0.5);
            expect(Math.abs(pose.height - before.height)).toBeLessThan(0.2);
          });
        }
        was = poses;
      }
      // Just after it leaves a bird is at its cover, at the crown; just before it is gone it is nearly clear.
      const first = posesOf(event, event.startsAt + 0.01, 3)[0]!;
      expect(Math.hypot(first.x - event.from.x, first.y - event.from.y)).toBeLessThan(0.2);
      expect(first.alpha).toBeLessThan(0.1);
      const last = posesOf(event, event.startsAt + CRITTERS_LOOK.flush.seconds - 0.01, 3)[0]!;
      expect(last.alpha).toBeLessThan(0.05);
    }
  });

  it('beats its wings through the strip, forwards and back', () => {
    const event = [...anHour(1).values()][0]!;
    const frames = new Set<number>();
    for (let at = 0; at < 1; at += 0.02) {
      for (const pose of posesOf(event, event.startsAt + 0.05 + at, 3)) frames.add(pose.frame);
    }
    expect([...frames].sort()).toEqual([0, 1, 2]);
  });
});

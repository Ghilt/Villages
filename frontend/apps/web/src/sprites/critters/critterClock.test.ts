import { describe, expect, it } from 'vitest';

import { CASTS } from './casts';
import { eventIn, eventsAt, lastsFor, posesOf, slotOf } from './critterClock';
import type { Cover, CritterEvent, Ground } from './critterClock';
import { CRITTERS_LOOK } from './look';

/** A wood of oaks so many world units apart, two unless told, the house seeing all of it, unless told otherwise. */
function wood(change: Partial<Ground> = {}, kind = 'oak', land = 'mixed-forest', apart = 2): Ground {
  return {
    coverIn(fromX, fromY, toX, toY) {
      const cover: Cover[] = [];
      for (let y = Math.ceil(fromY / apart) * apart; y < toY; y += apart) {
        for (let x = Math.ceil(fromX / apart) * apart; x < toX; x += apart) {
          cover.push({ x: x + 0.3, y: y + 0.7, kind, height: 4 });
        }
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

/** Every critter of the cells over an hour, or as many seconds as said, by its key. */
function anHour(density: number, ground = wood(), seconds = 3600): Map<string, CritterEvent> {
  const events = new Map<string, CritterEvent>();
  for (let slot = slotOf(NOW); slot < slotOf(NOW + seconds); slot += 1) {
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

  it('brings more as often goes up, keeping every one it had, until every cell is busy', () => {
    const usual = anHour(CRITTERS_LOOK.density, wood(), 600);
    const often = anHour(CRITTERS_LOOK.density * 20, wood(), 600);
    expect(often.size).toBeGreaterThan(usual.size * 5);
    for (const [key, event] of usual) expect(often.get(key)).toEqual(event);
    // At its most every cell's slot in a wood brings something: forty-one cells by thirty-one, fifty slots.
    expect(anHour(20, wood(), 600).size).toBe(41 * 31 * 50);
  });

  it('brings a critter only where its kind lives and out of what it comes out of', () => {
    expect(anHour(1, wood({}, 'boulder'), 600).size).toBe(0);
    expect(anHour(1, wood({}, 'oak', 'ocean'), 600).size).toBe(0);
    expect(anHour(1, wood({ classAt: () => null }), 600).size).toBe(0);
    for (const land of Object.keys(CASTS))
      expect(anHour(1, wood({}, 'oak', land), 600).size).toBeGreaterThan(0);
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
      // Just after it leaves a bird is at its cover, at the crown; just before it is gone it is nearly clear, and
      // one taking shelter is at the tree it goes into.
      for (const bird of event.birds) {
        const alone = { ...event, birds: [bird] };
        const first = posesOf(alone, event.startsAt + bird.delay + 0.01, 3)[0]!;
        expect(Math.hypot(first.x - event.from.x, first.y - event.from.y)).toBeLessThan(0.2);
        expect(first.alpha).toBeLessThan(0.1);
        const last = posesOf(alone, event.startsAt + bird.delay + bird.seconds - 0.01, 3)[0]!;
        expect(last.alpha).toBeLessThan(0.05);
        if (bird.to !== null) expect(Math.hypot(last.x - bird.to.x, last.y - bird.to.y)).toBeLessThan(0.3);
      }
    }
  });

  it('bursts a flock out of a tree, and flits a bird or two into the next tree, seeking shelter', () => {
    const events = [...anHour(1).values()];
    const flits = events.filter(
      (event) => event.birds.length <= 2 && event.birds.every((bird) => bird.to !== null),
    );
    const bursts = events.filter((event) => event.birds.some((bird) => bird.to === null));
    expect(flits.length).toBeGreaterThan(0);
    expect(bursts.length).toBeGreaterThan(0);
    // Some of a burst's birds drop into a tree near by too; every shelter is another tree, near enough.
    expect(bursts.some((event) => event.birds.some((bird) => bird.to !== null))).toBe(true);
    for (const bird of events.flatMap((event) => event.birds.map((one) => ({ one, from: event.from })))) {
      if (bird.one.to === null) continue;
      const away = Math.hypot(bird.one.to.x - bird.from.x, bird.one.to.y - bird.from.y);
      expect(away).toBeGreaterThanOrEqual(CRITTERS_LOOK.flush.shelter[0]);
      expect(away).toBeLessThanOrEqual(CRITTERS_LOOK.flush.shelter[1]);
    }
  });

  it('hooks a bird flying off late in its fade: a sharp turn, then a bird length or two straight down the screen', () => {
    const size = 0.55;
    const flying = [...anHour(1).values()]
      .flatMap((event) => event.birds.filter((bird) => bird.to === null).map((bird) => ({ event, bird })))
      .slice(0, 30);
    expect(flying.length).toBeGreaterThan(10);
    const F = CRITTERS_LOOK.flush;
    for (const { event, bird } of flying) {
      const alone = { ...event, birds: [bird] };
      const at = (share: number) =>
        posesOf(alone, event.startsAt + bird.delay + share * bird.seconds, 3, size)[0]!;
      const turning = at(F.hookAt + 0.001);
      const last = at(0.999);
      // Along the ground it goes on only a third of its length past where the hook begins, and then stops.
      expect(Math.hypot(last.x - turning.x, last.y - turning.y)).toBeLessThan(F.hookTurn * size + 0.01);
      // And it drops a bird length or two in height, which is straight down the screen, as it goes.
      const drop = turning.height - last.height;
      expect(drop).toBeGreaterThan(size);
      expect(drop).toBeLessThan(2 * size);
      // The hook leaves where the flight arrived.
      const before = at(F.hookAt - 0.001);
      expect(Math.hypot(turning.x - before.x, turning.y - before.y)).toBeLessThan(0.05);
      expect(Math.abs(turning.height - before.height)).toBeLessThan(0.05);
    }
  });

  it('only bursts out of a lone bush, with no other tree near to take shelter in', () => {
    const open = [...anHour(1, wood({}, 'scrub', 'meadow', 40)).values()];
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((event) => event.birds.every((bird) => bird.to === null))).toBe(true);
  });

  it('waits while the trees round a bird are not all known, rather than sending it elsewhere', () => {
    const wide = (fromX: number, fromY: number, toX: number, toY: number) =>
      toX - fromX > CRITTERS_LOOK.cell ? null : wood().coverIn(fromX, fromY, toX, toY);
    expect(anHour(1, wood({ coverIn: wide }), 600).size).toBe(0);
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

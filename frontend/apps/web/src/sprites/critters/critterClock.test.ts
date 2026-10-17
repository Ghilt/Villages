import { describe, expect, it } from 'vitest';

import { CASTS } from './casts';
import { eventIn, eventsAt, lastsFor, posesOf, ringsOf, slotOf } from './critterClock';
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

/** A corner of those cells, for the tests that fill every cell's every slot. */
const CORNER = { fromX: 2000, toX: 2020, fromY: 1000, toY: 1015 };

/** Every critter of the cells over an hour, or as many seconds as said, by its key. */
function anHour(density: number, ground = wood(), seconds = 3600, cells = CELLS): Map<string, CritterEvent> {
  const events = new Map<string, CritterEvent>();
  for (let slot = slotOf(NOW); slot < slotOf(NOW + seconds); slot += 1) {
    for (let cellY = cells.fromY; cellY <= cells.toY; cellY += 1) {
      for (let cellX = cells.fromX; cellX <= cells.toX; cellX += 1) {
        const event = eventIn(cellX, cellY, slot, density, ground);
        if (event !== null) events.set(event.key, event);
      }
    }
  }
  return events;
}

/** The flocks among some critters: the birds bursting out of cover or flitting to shelter. */
const flocks = (events: Iterable<CritterEvent>) => [...events].filter((event) => event.behaviour === 'flush');

describe("the critters' clock", () => {
  it('brings birds and squirrels out of the wood every so often', () => {
    const events = [...anHour(CRITTERS_LOOK.density).values()];
    // About one cell's slot in fifty at the fullest density, so at the usual one a few hundred an hour here.
    expect(events.length).toBeGreaterThan(100);
    const kinds = new Set(events.map((event) => `${event.kind} ${event.behaviour}`));
    expect([...kinds].sort()).toEqual(['songbird flush', 'squirrel hop']);
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
    const usual = anHour(CRITTERS_LOOK.density, wood(), 600, CORNER);
    const often = anHour(CRITTERS_LOOK.density * 20, wood(), 600, CORNER);
    expect(often.size).toBeGreaterThan(usual.size * 5);
    for (const [key, event] of usual) expect(often.get(key)).toEqual(event);
    // At its most every cell's slot in a wood brings something: twenty-one cells by sixteen, fifty slots.
    expect(anHour(20, wood(), 600, CORNER).size).toBe(21 * 16 * 50);
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
      for (const bird of event.animals) {
        const alone = { ...event, animals: [bird] };
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
    const events = flocks(anHour(1).values());
    const flits = events.filter(
      (event) => event.animals.length <= 2 && event.animals.every((bird) => bird.to !== null),
    );
    const bursts = events.filter((event) => event.animals.some((bird) => bird.to === null));
    expect(flits.length).toBeGreaterThan(0);
    expect(bursts.length).toBeGreaterThan(0);
    // Some of a burst's birds drop into a tree near by too; every shelter is another tree, near enough.
    expect(bursts.some((event) => event.animals.some((bird) => bird.to !== null))).toBe(true);
    for (const bird of events.flatMap((event) => event.animals.map((one) => ({ one, from: event.from })))) {
      if (bird.one.to === null) continue;
      const away = Math.hypot(bird.one.to.x - bird.from.x, bird.one.to.y - bird.from.y);
      expect(away).toBeGreaterThanOrEqual(CRITTERS_LOOK.flush.shelter[0]);
      expect(away).toBeLessThanOrEqual(CRITTERS_LOOK.flush.shelter[1]);
    }
  });

  it('hooks a bird flying off late in its fade: a sharp turn, then a bird length or two straight down the screen', () => {
    const size = 0.55;
    const flying = flocks(anHour(1).values())
      .flatMap((event) => event.animals.filter((bird) => bird.to === null).map((bird) => ({ event, bird })))
      .slice(0, 30);
    expect(flying.length).toBeGreaterThan(10);
    const F = CRITTERS_LOOK.flush;
    for (const { event, bird } of flying) {
      const alone = { ...event, animals: [bird] };
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
    expect(open.every((event) => event.animals.every((bird) => bird.to === null))).toBe(true);
  });

  it('waits while the trees round a bird are not all known, rather than sending it elsewhere', () => {
    const wide = (fromX: number, fromY: number, toX: number, toY: number) =>
      toX - fromX > CRITTERS_LOOK.cell ? null : wood().coverIn(fromX, fromY, toX, toY);
    expect(anHour(1, wood({ coverIn: wide }), 600).size).toBe(0);
  });

  it('beats its wings through the strip, forwards and back', () => {
    const event = flocks(anHour(1).values())[0]!;
    const frames = new Set<number>();
    for (let at = 0; at < 1; at += 0.02) {
      for (const pose of posesOf(event, event.startsAt + 0.05 + at, 3)) frames.add(pose.frame);
    }
    expect([...frames].sort()).toEqual([0, 1, 2]);
  });

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
    const meadow = [...anHour(1, wood({}, 'grass', 'meadow', 3), 600).values()];
    expect(meadow.length).toBeGreaterThan(0);
    expect(meadow.every((event) => event.kind === 'hare' && event.behaviour === 'hop')).toBe(true);
    // Neither comes out of what it does not live in: no hare in a wood of tufts, no squirrel among a meadow's oaks.
    expect(anHour(1, wood({}, 'grass', 'mixed-forest', 3), 600).size).toBe(0);
    const oaks = [...anHour(1, wood({}, 'oak', 'meadow'), 600).values()];
    expect(oaks.length).toBeGreaterThan(0);
    expect(oaks.every((event) => event.kind === 'songbird')).toBe(true);
  });

  it('brings no hare where there is no cover near enough to run to', () => {
    expect(anHour(1, wood({}, 'grass', 'meadow', 40), 600).size).toBe(0);
  });

  it('leaps a fish out of a lake, a river or the shallow sea, and never out of the land', () => {
    for (const water of ['lake', 'river', 'shallow-sea']) {
      const fish = [...anHour(1, wood({ coverIn: () => [] }, 'oak', water), 600).values()];
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

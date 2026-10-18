import { describe, expect, it } from 'vitest';

import { CASTS } from './casts';
import { eventsAt, lastsFor, posesOf } from './critterClock';
import { CELLS, CORNER, NOW, anHour, flocks, wood } from './critterTestWorld';
import { CRITTERS_LOOK } from './look';

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
    expect(anHour(1, wood({}, 'oak', 'no-such-ground'), 600).size).toBe(0);
    expect(anHour(1, wood({ classAt: () => null }), 600).size).toBe(0);
    for (const [land, cast] of Object.entries(CASTS)) {
      // Out of the first cover any of its cast comes out of, or a wood's oaks for a cast that needs none.
      const cover = cast.flatMap((member) => member.from)[0] ?? 'oak';
      expect(anHour(1, wood({}, cover, land), 600).size).toBeGreaterThan(0);
    }
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
        // From where it sat: its cover's point, or a little apart from it in a burst.
        const [sx, sy] = [event.from.x + (bird.nudge?.x ?? 0), event.from.y + (bird.nudge?.y ?? 0)];
        expect(Math.hypot(first.x - sx, first.y - sy)).toBeLessThan(0.2);
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

  it("flies a burst's birds on arcs, all curving the same way together, as a flock turns", () => {
    const F = CRITTERS_LOOK.flush;
    const bursts = flocks(anHour(1).values())
      .filter((event) => event.animals.filter((bird) => bird.to === null).length >= 2)
      .slice(0, 30);
    expect(bursts.length).toBeGreaterThan(5);
    for (const event of bursts) {
      const bows = event.animals.filter((bird) => bird.to === null).map((bird) => bird.bow);
      expect(new Set(bows.map(Math.sign)).size).toBe(1);
      expect(Math.min(...bows.map(Math.abs))).toBeGreaterThan(0.4);
      expect(Math.max(...bows.map(Math.abs)) / Math.min(...bows.map(Math.abs))).toBeLessThan(1.5);
      for (const bird of event.animals.filter((one) => one.to === null)) {
        const at = (share: number) =>
          posesOf({ ...event, animals: [bird] }, event.startsAt + bird.delay + share * bird.seconds, 3)[0]!;
        const [a, b, c] = [at(0.05), at(F.hookAt * 0.5), at(F.hookAt - 0.01)];
        const chord = Math.hypot(c.x - a.x, c.y - a.y);
        // How far the middle of its way stands off the straight line between its ends, and to which side.
        const off = ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / chord;
        if (Math.abs(bird.bow) > 0.4) {
          expect(Math.abs(off) / chord).toBeGreaterThan(0.02);
          expect(Math.sign(off)).toBe(Math.sign(bird.bow));
        }
      }
    }
  });

  it('fires a burst like a shotgun, the flock one way, each bird a little apart where it sat', () => {
    const F = CRITTERS_LOOK.flush;
    for (const event of flocks(anHour(1).values()).slice(0, 60)) {
      const flying = event.animals.filter((bird) => bird.to === null);
      if (flying.length < 2) continue;
      const headings = flying.map((bird) => bird.heading);
      // Every bird within the narrow fan and a little either way of it, so the flock leaves in one direction.
      const widest = Math.max(...headings) - Math.min(...headings);
      expect(widest).toBeLessThanOrEqual((F.spread * Math.PI) / 180 + 0.1 + 1e-9);
      for (const bird of flying) {
        expect(Math.abs(bird.nudge!.x)).toBeLessThanOrEqual(F.scatter);
        expect(Math.abs(bird.nudge!.y)).toBeLessThanOrEqual(F.scatter);
        expect(Math.abs(bird.nudge!.height)).toBeLessThanOrEqual(F.scatter);
      }
      expect(new Set(flying.map((bird) => `${bird.nudge!.x},${bird.nudge!.y}`)).size).toBe(flying.length);
    }
  });

  it('keeps a bird flying off whole through its hook, and fades it quickly once it has settled', () => {
    const F = CRITTERS_LOOK.flush;
    const flying = flocks(anHour(1).values())
      .flatMap((event) => event.animals.filter((bird) => bird.to === null).map((bird) => ({ event, bird })))
      .slice(0, 20);
    for (const { event, bird } of flying) {
      const at = (share: number) =>
        posesOf({ ...event, animals: [bird] }, event.startsAt + bird.delay + share * bird.seconds, 3)[0]!;
      expect(at(F.hookAt + 0.01).alpha).toBe(1);
      expect(at(1 - F.fadeOut - 0.001).alpha).toBe(1);
      // Settled where the drop left it while it fades, which is over in a quarter of a second or so.
      const settled = at(1 - F.fadeOut + 0.001);
      expect(Math.hypot(at(0.999).x - settled.x, at(0.999).y - settled.y)).toBeLessThan(1e-9);
      expect(at(0.999).alpha).toBeLessThan(0.05);
      expect(F.fadeOut * bird.seconds).toBeLessThan(0.3);
    }
  });

  it('hooks a bird flying off late in its flight: a sharp turn, then half a bird length straight down the screen', () => {
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
      // And it drops a little over half a bird length in height, which is straight down the screen, as it goes.
      const drop = turning.height - last.height;
      expect(drop).toBeGreaterThan(size / 2);
      expect(drop).toBeLessThan(size);
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
});

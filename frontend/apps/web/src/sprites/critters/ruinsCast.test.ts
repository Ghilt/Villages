import { readFileSync } from 'node:fs';

import { CULTURES, RUIN_PIECES, ruinFrameKey } from '@villages/world';
import { describe, expect, it } from 'vitest';

import { CASTS, RUINS_CAST, isRuin } from './casts';
import { critterHash, lastsFor, posesOf } from './critterClock';
import { anHour, ruinedWood, wood } from './critterTestWorld';
import { CRITTERS_LOOK } from './look';
import { soarer, soarersOf } from './soar';

const CRITTERS = (
  JSON.parse(readFileSync(new URL('../../../../../../world/critters.json', import.meta.url), 'utf8')) as {
    kinds: { name: string }[];
  }
).kinds.map((one) => one.name);

const PIECES = RUIN_PIECES.flatMap((piece) => CULTURES.map((culture) => ruinFrameKey(piece, culture)));
const OF_THE_RUINS = new Set(RUINS_CAST.map((member) => member.kind));

describe("the ruins' cast", () => {
  it('names only critters there are, each with a size, and comes only out of pieces of the ruins', () => {
    expect(RUINS_CAST.filter((member) => !CRITTERS.includes(member.kind))).toEqual([]);
    expect(RUINS_CAST.filter((member) => CRITTERS_LOOK.kinds[member.kind] === undefined)).toEqual([]);
    expect(RUINS_CAST.flatMap((member) => member.from).filter((kind) => !PIECES.includes(kind))).toEqual([]);
    expect(PIECES.every(isRuin)).toBe(true);
    // A hopping member needs its own numbers, or it would never leave its cover.
    for (const member of RUINS_CAST.filter((one) => one.behaviour === 'hop')) {
      expect(CRITTERS_LOOK.hop[member.kind]).toBeDefined();
    }
  });

  it("is nobody else's: no ground has a crow or a rat, so nothing but a ruin brings one out", () => {
    expect(
      Object.values(CASTS)
        .flat()
        .filter((member) => OF_THE_RUINS.has(member.kind)),
    ).toEqual([]);
    for (const land of Object.keys(CASTS)) {
      const events = [...anHour(1, wood({}, 'oak', land), 600).values()];
      expect(events.filter((event) => OF_THE_RUINS.has(event.kind))).toEqual([]);
    }
  });

  it('brings crows out of what stands high, rats out of what has fallen, and songbirds out of the trees among them', () => {
    const events = [...anHour(1, ruinedWood()).values()];
    const kinds = new Set(events.map((event) => `${event.kind} ${event.behaviour}`));
    // And partridges off the open fields between, which come out of no piece of it.
    expect([...kinds].sort()).toEqual([
      'crow flush',
      'crow-aloft soar',
      'partridge flush',
      'rat hop',
      'songbird flush',
    ]);
    for (const event of events) {
      if (event.kind === 'crow') expect(event.from.kind).toBe('ruin:hall-european');
      if (event.kind === 'rat')
        expect(['ruin:rubble-european', 'ruin:shell-islamic']).toContain(event.from.kind);
      if (event.kind === 'crow-aloft') expect(isRuin(event.from.kind)).toBe(true);
      if (event.kind === 'songbird') expect(event.from.kind).toBe('oak');
    }
    // A crow taking shelter goes into another high piece, and a rat runs only to another fallen one.
    for (const event of events) {
      for (const animal of event.animals) {
        if (animal.to === null) continue;
        if (event.kind === 'crow') expect(animal.to.kind).toBe('ruin:hall-european');
        if (event.kind === 'rat')
          expect(['ruin:rubble-european', 'ruin:shell-islamic']).toContain(animal.to.kind);
      }
    }
  });

  it('brings them whatever ground the ruin stands on, even ground with no cast of its own', () => {
    const bare = [...anHour(1, ruinedWood({ classAt: () => 'tundra' }), 600).values()];
    expect(bare.length).toBeGreaterThan(0);
    expect(bare.every((event) => OF_THE_RUINS.has(event.kind))).toBe(true);
  });

  it('bursts crows out in a bigger flock than the songbirds, and circles them two or three together', () => {
    const events = [...anHour(1, ruinedWood()).values()];
    const [fewest, most] = CRITTERS_LOOK.kinds.crow!.together!;
    const bursts = events.filter(
      (event) => event.kind === 'crow' && event.animals.some((one) => one.to === null),
    );
    expect(bursts.length).toBeGreaterThan(0);
    for (const event of bursts) {
      expect(event.animals.length).toBeGreaterThanOrEqual(fewest);
      expect(event.animals.length).toBeLessThanOrEqual(most);
    }
    const circling = events.filter((event) => event.kind === 'crow-aloft');
    expect(circling.length).toBeGreaterThan(0);
    for (const event of circling) {
      expect(event.animals.length).toBeGreaterThanOrEqual(2);
      expect(event.animals.length).toBeLessThanOrEqual(3);
      // Each on a circle of its own over the same piece.
      expect(new Set(event.animals.map((one) => one.heading)).size).toBe(event.animals.length);
    }
  });

  it('keeps a hawk the lone hawk it was', () => {
    for (let slot = 0; slot < 50; slot += 1) {
      const draw = (salt: number) => critterHash(7, 9, slot, salt);
      expect(soarersOf('hawk', draw)).toEqual([soarer(draw)]);
    }
  });

  it('never pops a rat: it comes out of its rubble and goes into the next, low and quick', () => {
    const rats = [...anHour(1, ruinedWood()).values()].filter((event) => event.kind === 'rat').slice(0, 20);
    expect(rats.length).toBeGreaterThan(5);
    for (const event of rats) {
      const rat = event.animals[0]!;
      const start = posesOf(event, event.startsAt + 0.01, 3)[0]!;
      const end = posesOf(event, event.startsAt + lastsFor(event) - 0.01, 3)[0]!;
      expect(start.alpha).toBeLessThan(0.1);
      expect(end.alpha).toBeLessThan(0.1);
      expect(Math.hypot(end.x - rat.to!.x, end.y - rat.to!.y)).toBeLessThan(0.3);
      for (let at = 0; at < lastsFor(event); at += 0.05) {
        for (const pose of posesOf(event, event.startsAt + at, 3)) {
          expect(pose.height).toBeLessThanOrEqual(CRITTERS_LOOK.hop.rat!.high + 1e-9);
        }
      }
    }
  });
});

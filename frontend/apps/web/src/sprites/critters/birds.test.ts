import { describe, expect, it } from 'vitest';

import { lastsFor, posesOf } from './critterClock';
import { anHour, wood } from './critterTestWorld';
import { CRITTERS_LOOK } from './look';
import type { CritterEvent } from './types';

const L = CRITTERS_LOOK;

/** Open ground of the class said with nothing standing on it, the house seeing all of it. */
const open = (land: string) => wood({ coverIn: () => [] }, 'oak', land);

/** Every pose of a critter over the whole of it, at so many moments. */
const posesOver = (event: CritterEvent, steps = 200) =>
  Array.from({ length: steps }, (_, at) =>
    posesOf(event, event.startsAt + ((at + 0.5) / steps) * lastsFor(event), 3, L.kinds[event.kind]!.size),
  ).flat();

const ofKind = (events: Iterable<CritterEvent>, kind: string) =>
  [...events].filter((event) => event.kind === kind);

describe('the birds of the open ground', () => {
  it('bursts a covey of partridges up off the open field where nothing stands, low, and never popping', () => {
    const coveys = ofKind(anHour(1, open('farmland'), 600).values(), 'partridge');
    expect(coveys.length).toBeGreaterThan(5);
    const [fewest, most] = L.kinds.partridge!.together!;
    for (const covey of coveys) {
      expect(covey.behaviour).toBe('flush');
      expect(covey.from).toMatchObject({ kind: 'farmland', height: 0 });
      expect(covey.animals.length).toBeGreaterThanOrEqual(fewest);
      expect(covey.animals.length).toBeLessThanOrEqual(most);
      // Off the field and away, none of them taking shelter: there is nowhere to.
      expect(covey.animals.every((bird) => bird.to === null)).toBe(true);
      const poses = posesOver(covey);
      expect(Math.max(...poses.map((pose) => pose.height))).toBeLessThan(L.kinds.partridge!.climb! + 0.5);
      // Out of the field within a moment, as a bird comes out of its cover.
      expect(posesOf(covey, covey.startsAt + 0.01, 3)[0]!.alpha).toBeLessThan(0.1);
    }
  });

  it('rises a lark high over the grass and brings it down not far from where it rose', () => {
    const larks = ofKind(anHour(1, open('meadow'), 1200).values(), 'lark');
    expect(larks.length).toBeGreaterThan(3);
    const songbirdReach = L.flush.reach;
    for (const lark of larks) {
      expect(lark.animals.length).toBeLessThanOrEqual(2);
      const poses = posesOver(lark);
      expect(Math.max(...poses.map((pose) => pose.height))).toBeGreaterThan(L.flush.climb + 1);
      const away = Math.max(...poses.map((pose) => Math.hypot(pose.x - lark.from.x, pose.y - lark.from.y)));
      expect(away).toBeLessThan(songbirdReach * 0.6);
    }
  });

  it('brings grouse out of the heather of the heath, and out of nothing else there', () => {
    const heath = [...anHour(1, wood({}, 'heather', 'heath', 2), 900).values()];
    const grouse = ofKind(heath, 'grouse');
    expect(grouse.length).toBeGreaterThan(5);
    expect(grouse.every((event) => event.from.kind === 'heather' && event.behaviour === 'flush')).toBe(true);
    // Among the heath's boulders, nothing: neither the grouse nor the songbirds come out of a stone.
    expect(anHour(1, wood({}, 'boulder', 'heath', 2), 900).size).toBe(0);
  });

  it('bursts ptarmigan off the open ice and the polar desert, and out of the heather of the tundra', () => {
    // The arctic hares bounding over the same snow and out of the same heather are the hop's: see dry.test.ts.
    for (const land of ['ice', 'polar-desert']) {
      const birds = [...anHour(1, open(land), 900).values()].filter((event) => event.behaviour === 'flush');
      expect(birds.length).toBeGreaterThan(5);
      expect(birds.every((event) => event.kind === 'ptarmigan' && event.from.kind === land)).toBe(true);
    }
    const tundra = ofKind(anHour(1, wood({}, 'heather', 'tundra', 2), 600).values(), 'ptarmigan');
    expect(tundra.length).toBeGreaterThan(5);
    expect(tundra.every((event) => event.from.kind === 'heather')).toBe(true);
    // And on the open tundra, where none of its heather stands, none.
    expect(anHour(1, open('tundra'), 600).size).toBe(0);
  });

  it('flies a duck higher and further than a partridge, off the wet land', () => {
    const ducks = ofKind(anHour(1, open('marsh'), 900).values(), 'duck');
    expect(ducks.length).toBeGreaterThan(5);
    const highest = (events: CritterEvent[]) =>
      events.reduce((most, event) => Math.max(most, ...posesOver(event).map((pose) => pose.height)), 0);
    const partridges = ofKind(anHour(1, open('farmland'), 600).values(), 'partridge');
    expect(highest(ducks)).toBeGreaterThan(highest(partridges) + 1);
  });
});

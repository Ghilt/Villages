import { describe, expect, it } from 'vitest';

import {
  describeMaster,
  describeOrigin,
  isStale,
  isUnfurnished,
  originNeeds,
  since,
  worldRootOf,
} from './masters';
import type { MasterOnDisk, Standing } from './masters';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const STEPS = [
  'import',
  'tile',
  'styles',
  'flow',
  'sprites',
  'ground',
  'origin',
  'names',
  'culture',
  'height',
];

/** A master every step of which is current, but for the ones given otherwise, with why. */
function master(
  fields: Partial<MasterOnDisk> = {},
  standing: Record<string, [Standing, string?]> = {},
): MasterOnDisk {
  return {
    name: 'terrain',
    file: 'terrain.png',
    width: 32768,
    height: 16384,
    bytes: 24_749_719,
    drawn: true,
    steps: STEPS.map((name) => {
      const [is, why] = standing[name] ?? ['current'];
      return { name, standing: is, why: why === undefined ? [] : [why] };
    }),
    ...fields,
  };
}

const painted = {
  import: ['to make', 'world/master/terrain.png changed'],
  tile: ['to make', 'world/master/terrain.png changed'],
  flow: ['to make', 'world/master/terrain.png changed'],
  sprites: ['to make', 'world/master/terrain.png changed'],
  ground: ['to make', 'world/master/terrain.png changed'],
  origin: ['to make', 'world/master/terrain.png changed'],
  names: ['to make', 'origin, which it is made from, was made again'],
  culture: ['to make', 'origin, which it is made from, was made again'],
  height: ['to make', 'world/master/terrain.png changed'],
} satisfies Record<string, [Standing, string]>;

describe('where a master is served from', () => {
  it('is a directory of its own, so more than one can exist at a time', () => {
    expect(worldRootOf('terrain')).toBe('/world/masters/terrain');
    expect(worldRootOf('terrain2')).toBe('/world/masters/terrain2');
  });
});

describe('whether what is drawn is what the image says', () => {
  it('is stale when the master was painted since, which is what a Photoshop save looks like', () => {
    expect(isStale(master({}, painted))).toBe(true);
  });

  it('is stale when a file the tiles are made from was saved since, a palette or the render colours', () => {
    expect(isStale(master({}, { tile: ['to make', 'world/render.json changed'] }))).toBe(true);
  });

  it('is not stale when every step is what it is made from, however recently the tree was checked out', () => {
    expect(isStale(master())).toBe(false);
  });

  it('is not stale when it has never been cut, because there is nothing to be out of date', () => {
    expect(isStale(master({ drawn: false }, painted))).toBe(false);
  });
});

describe('what the panel says about the chosen master', () => {
  it('says the size, because a master of the wrong size is the likeliest mistake', () => {
    expect(describeMaster(master(), 'terrain', false)).toContain('32768 by 16384');
  });

  it('says when the size is not the one the world is built around', () => {
    const half = master({ width: 16384, height: 8192 });

    expect(describeMaster(half, 'terrain', false)).toContain('16384 by 8192');
    expect(describeMaster(half, 'terrain', false)).toContain('not the 32768');
    expect(describeMaster(master(), 'terrain', false)).not.toContain('not the');
  });

  it('says when it has never been cut here, and when the world cache has it all the same', () => {
    expect(describeMaster(master({ drawn: false }, painted), 'terrain', false)).toContain('never cut');
    const shelved = master({ drawn: false }, { tile: ['on the shelf', 'nothing was made before'] });
    expect(describeMaster(shelved, 'terrain', false)).toContain('the world cache has it');
  });

  it('says which step is out of date and why, when the image has been painted since', () => {
    const told = describeMaster(master({}, painted), 'terrain', false);

    expect(told).toContain('out of date');
    expect(told).toContain('world/master/terrain.png changed');
  });

  it('says what it is doing while it cuts, and that the world cache can make it quick', () => {
    expect(describeMaster(master(), 'terrain', 'cut')).toContain('world cache');
  });

  it('says what it is doing while it furnishes, which is the quick one of the two', () => {
    expect(describeMaster(master(), 'terrain', 'furnish')).toContain('biomes');
  });

  it('says when a master grows nothing, because that is a state and not a fault', () => {
    const bare = master({}, { sprites: ['cannot', 'world/biomes.json is missing'] });
    expect(describeMaster(bare, 'terrain', false)).toContain('growing nothing');
  });

  it('says when the table was tuned since the biomes were worked out, and names the file', () => {
    const tuned = describeMaster(
      master({}, { sprites: ['to make', 'world/biomes.json changed'] }),
      'terrain',
      false,
    );

    expect(tuned).toContain('world/biomes.json');
    expect(tuned).toContain('sprite map is out of date');
  });

  it('says when every step is current, and what it has none of', () => {
    expect(describeMaster(master(), 'terrain', false)).toContain('current');
    const nameless = master({}, { names: ['cannot', 'world/source/ne_10m_lakes.geojson is missing'] });
    expect(describeMaster(nameless, 'terrain', false)).toContain('but no names');
  });

  it('falls back to the master being drawn when nothing answered, which is a built app', () => {
    expect(describeMaster(undefined, 'terrain2', false)).toContain('terrain2');
  });
});

describe('whether a master is furnished', () => {
  it('is not, when its sprite map cannot be made or is out of date', () => {
    expect(isUnfurnished(master({}, { sprites: ['cannot', 'world/biomes.json is missing'] }))).toBe(true);
    expect(isUnfurnished(master({}, painted))).toBe(true);
  });

  it('is, when the sprite map is what it is made from', () => {
    expect(isUnfurnished(master())).toBe(false);
  });

  /**
   * The one that matters in practice. Tuning a look edits world/biomes.json and no master, so a sprite map goes
   * out of date with nothing on any image having changed; its fingerprint is made from the file, so it moves.
   */
  it('is not, when world/biomes.json was saved since, and the tiles are not stale for it', () => {
    const tuned = master({}, { sprites: ['to make', 'world/biomes.json changed'] });

    expect(isUnfurnished(tuned)).toBe(true);
    expect(isStale(tuned)).toBe(false);
  });
});

describe('saying how long ago', () => {
  it('counts seconds, then minutes, then hours, then days', () => {
    const now = Date.now();

    expect(since(now - 20 * SECOND)).toBe('20 seconds');
    expect(since(now - 10 * MINUTE)).toBe('10 minutes');
    expect(since(now - 5 * HOUR)).toBe('5 hours');
    expect(since(now - 72 * HOUR)).toBe('3 days');
  });

  it('says one of a thing rather than one things', () => {
    expect(since(Date.now() - SECOND)).toBe('1 second');
    expect(since(Date.now() - 100 * MINUTE)).toBe('2 hours');
  });

  it('never reads as the future, however the clocks disagree', () => {
    expect(since(Date.now() + 10 * MINUTE)).toBe('0 seconds');
  });
});

describe('whether the real names stand on the ground the master has now', () => {
  it('needs nothing when its origin map and names are what they are made from', () => {
    expect(originNeeds(master())).toBeNull();
    expect(describeOrigin(master())).toBe('');
  });

  it('needs its origin worked out again when the master was painted since, which moves land under the names', () => {
    const moved = master({}, { origin: painted.origin, names: painted.names, culture: painted.culture });
    expect(originNeeds(moved)).toBe('origin');
    expect(describeOrigin(moved)).toContain('wrong ground');
  });

  it('needs only its names carried again when the review of 1790 or the lines about the waters were saved since', () => {
    const reviewed = master({}, { names: ['to make', 'world/names/1790.json changed'] });
    expect(originNeeds(reviewed)).toBe('names');
    expect(describeOrigin(reviewed)).toContain('world/names/1790.json changed');
  });

  it('says when there are no names to carry, and why', () => {
    const nameless = master({}, { names: ['cannot', 'world/source/ne_10m_lakes.geojson is missing'] });
    expect(originNeeds(nameless)).toBeNull();
    expect(describeOrigin(nameless)).toContain('no real names');
  });

  it('needs nothing of a master that is not cut, which has no ground for names yet', () => {
    expect(originNeeds(master({ drawn: false }, painted))).toBeNull();
  });
});

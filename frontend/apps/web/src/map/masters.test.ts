import { describe, expect, it } from 'vitest';

import { describeMaster, isStale, isUnfurnished, since, worldRootOf } from './masters';
import type { MasterOnDisk } from './masters';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

function master(fields: Partial<MasterOnDisk> = {}): MasterOnDisk {
  return {
    name: 'terrain',
    file: 'terrain.png',
    width: 32768,
    height: 16384,
    bytes: 24_749_719,
    editedAt: Date.now() - HOUR,
    cutAt: Date.now() - 30 * MINUTE,
    furnishedAt: Date.now() - 29 * MINUTE,
    ...fields,
  };
}

describe('where a master is served from', () => {
  it('is a directory of its own, so more than one can exist at a time', () => {
    expect(worldRootOf('terrain')).toBe('/world/masters/terrain');
    expect(worldRootOf('terrain2')).toBe('/world/masters/terrain2');
  });
});

describe('whether what is drawn is what the image says', () => {
  it('is stale when the master was saved after it was cut, which is what a Photoshop save looks like', () => {
    expect(isStale(master({ cutAt: 1000, editedAt: 2000 }))).toBe(true);
  });

  it('is not stale when it was cut after the last save', () => {
    expect(isStale(master({ cutAt: 2000, editedAt: 1000 }))).toBe(false);
  });

  it('is not stale when it has never been cut, because there is nothing to be out of date', () => {
    expect(isStale(master({ cutAt: null }))).toBe(false);
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

  it('says when it has never been cut, which is why nothing would be drawn', () => {
    expect(describeMaster(master({ cutAt: null }), 'terrain', false)).toContain('never cut');
  });

  it('says when the image has been painted since it was cut', () => {
    const painted = master({ cutAt: Date.now() - HOUR, editedAt: Date.now() - MINUTE });

    expect(describeMaster(painted, 'terrain', false)).toContain('after it was last cut');
  });

  it('says what it is doing while it cuts, because that takes a minute and a half', () => {
    expect(describeMaster(master(), 'terrain', 'cut')).toContain('cutting the tiles');
  });

  it('says what it is doing while it furnishes, which is the quick one of the two', () => {
    expect(describeMaster(master(), 'terrain', 'furnish')).toContain('biomes');
  });

  it('says when a master is cut but grows nothing, because that is a state and not a fault', () => {
    expect(describeMaster(master({ furnishedAt: null }), 'terrain', false)).toContain('no sprite map');
  });

  it('says when the table was tuned since the biomes were worked out, and names the file', () => {
    const tuned = describeMaster(master({ furnishedAt: Date.now() - HOUR }), 'terrain', false, Date.now());

    expect(tuned).toContain('world/biomes.json');
    expect(tuned).toContain('after its biomes');
  });

  it('says when the image has been painted since its biomes were worked out', () => {
    // Cut after the paint but furnished before it, which is what a biomes.json edit followed by a
    // recut of the tiles alone would leave behind.
    const painted = master({
      cutAt: Date.now() - 30 * SECOND,
      editedAt: Date.now() - MINUTE,
      furnishedAt: Date.now() - HOUR,
    });

    expect(isStale(painted)).toBe(false);
    expect(describeMaster(painted, 'terrain', false)).toContain('after its biomes');
  });

  it('falls back to the master being drawn when nothing answered, which is a built app', () => {
    expect(describeMaster(undefined, 'terrain2', false)).toContain('terrain2');
  });
});

describe('whether a master is furnished', () => {
  it('is not, when it has no sprite map at all', () => {
    expect(isUnfurnished(master({ furnishedAt: null }), null)).toBe(true);
  });

  it('is not, when the image was painted afterwards', () => {
    expect(
      isUnfurnished(master({ furnishedAt: Date.now() - HOUR, editedAt: Date.now() - MINUTE }), null),
    ).toBe(true);
  });

  it('is, when the sprite map is newer than the paint', () => {
    expect(isUnfurnished(master(), null)).toBe(false);
  });

  /**
   * The one that matters in practice, and the one this was written without for a moment. Tuning a look
   * edits world/biomes.json and no master, so a sprite map goes out of date with nothing on any image
   * having changed - and a panel watching only the images would go on calling every world current.
   */
  it('is not, when world/biomes.json was saved after the sprite map was made', () => {
    const furnished = master({ furnishedAt: Date.now() - HOUR });

    expect(isUnfurnished(furnished, Date.now() - MINUTE)).toBe(true);
    expect(isUnfurnished(furnished, Date.now() - 2 * HOUR)).toBe(false);
  });

  /**
   * The two go stale for the same reason and are mended by different commands, so a master can want
   * one, the other, or both. Keeping them apart is what makes a biomes.json edit half a minute.
   */
  it('is a separate question from whether the tiles are stale', () => {
    const justRecut = master({ cutAt: Date.now() - MINUTE, furnishedAt: null });

    expect(isStale(justRecut)).toBe(false);
    expect(isUnfurnished(justRecut, null)).toBe(true);
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

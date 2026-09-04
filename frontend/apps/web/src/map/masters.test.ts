import { describe, expect, it } from 'vitest';

import { describeMaster, isStale, since, worldRootOf } from './masters';
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
    expect(describeMaster(master(), 'terrain', true)).toContain('cutting the tiles');
  });

  it('falls back to the master being drawn when nothing answered, which is a built app', () => {
    expect(describeMaster(undefined, 'terrain2', false)).toContain('terrain2');
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

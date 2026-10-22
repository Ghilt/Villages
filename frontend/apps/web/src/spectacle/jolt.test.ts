import { describe, expect, it } from 'vitest';

import { joltAt, MATCHED } from './jolt';
import type { Field, SliceNow } from './replay';

const slice = (actor: string, aspect: SliceNow['aspect'], state: SliceNow['state']): SliceNow => ({
  side: actor.startsWith('a') ? 'a' : 'b',
  index: Number(actor.slice(1)) - 1,
  actor,
  aspect,
  state,
  bearing: [],
});

const field = (a: readonly SliceNow[], b: readonly SliceNow[]): Field => ({
  second: 0,
  tug: 0,
  happening: { index: 0, aspects: ['holy'], from: 0, to: 15 },
  standing: [],
  slices: { a, b },
  pulled: new Map(),
  moments: [],
});

describe('a happening’s jolt', () => {
  const lit = field(
    [slice('a1', 'holy', 'matching'), slice('a2', 'diplomacy', 'working')],
    [slice('b1', 'reason', 'answering')],
  );

  it('runs to each house whose slices it lights, gold where one matches, the aspect’s colour where one answers', () => {
    expect(joltAt(15, [0, 15, 30], lit)).toEqual({
      key: 1,
      to: [
        { side: 'a', colour: MATCHED },
        { side: 'b', colour: 'var(--ui-aspect-reason)' },
      ],
    });
  });

  it('lasts the second its happening arrives and the one after, and is gone between', () => {
    expect(joltAt(16, [0, 15, 30], lit)?.key).toBe(1);
    expect(joltAt(17, [0, 15, 30], lit)).toBeUndefined();
  });

  it('is nothing before the first second, or for a happening lighting nobody', () => {
    expect(joltAt(-2, [0], lit)).toBeUndefined();
    const dark = field([slice('a1', 'holy', 'idle')], [slice('b1', 'reason', 'working')]);
    expect(joltAt(0, [0], dark)).toBeUndefined();
  });
});

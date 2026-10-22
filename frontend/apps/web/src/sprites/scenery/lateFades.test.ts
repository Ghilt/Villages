import { describe, expect, it } from 'vitest';

import { LATE_FADE_MS, createLateFades } from './lateFades';

describe('a wood built late', () => {
  it('fades in by a clock of its own, from nought to whole over its time, and is then left alone', () => {
    const late = createLateFades<string>();
    late.start('cell', 3);
    expect(late.of('cell', 3)).toBe(0);
    expect(late.of('cell', 4)).toBe(1);

    const written: number[] = [];
    expect(late.step(LATE_FADE_MS / 2, (_, __, fade) => written.push(fade))).toBe(true);
    expect(late.step(LATE_FADE_MS / 2, (_, __, fade) => written.push(fade))).toBe(false);
    expect(written).toEqual([0.5, 1]);
    expect(late.of('cell', 3)).toBe(1);
    expect(late.step(LATE_FADE_MS, () => written.push(-1))).toBe(false);
    expect(written).toEqual([0.5, 1]);
  });

  it('stops fading what has gone', () => {
    const late = createLateFades<string>();
    late.start('a', 1);
    late.start('a', 2);
    late.start('b', 1);
    late.forget('a', 1);
    late.forget('b');
    const seen: string[] = [];
    late.step(10, (cell, group) => seen.push(`${cell}/${group}`));
    expect(seen).toEqual(['a/2']);
    late.clear();
    expect(late.step(10, () => seen.push('x'))).toBe(false);
  });
});

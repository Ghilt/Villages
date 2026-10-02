import { describe, expect, it } from 'vitest';

import { LEAST_MS, lifeOf, MOST_MS, stayOf } from './life';
import type { Clock } from './life';

/** A clock that only moves when it is told to, and does what is due as it passes. */
function standIn(): Clock & { pass: (ms: number) => void; waiting: () => number } {
  let now = 0;
  let next = 0;
  const due = new Map<number, { at: number; then: () => void }>();
  return {
    set: (then, ms) => {
      next += 1;
      due.set(next, { at: now + ms, then });
      return next;
    },
    clear: (handle) => {
      due.delete(handle as number);
    },
    now: () => now,
    pass: (ms) => {
      now += ms;
      for (const [handle, { at, then }] of [...due]) {
        if (at <= now) {
          due.delete(handle);
          then();
        }
      }
    },
    waiting: () => due.size,
  };
}

describe('how long a toast stays', () => {
  it('is longer for more words, between the least and the most', () => {
    expect(stayOf(0)).toBe(LEAST_MS);
    expect(stayOf(100)).toBe(8000);
    expect(stayOf(1000)).toBe(MOST_MS);
    expect(stayOf(60)).toBeLessThan(stayOf(120));
  });
});

describe('a toast’s life', () => {
  it('ends once it has run its whole time', () => {
    const clock = standIn();
    let ended = 0;
    lifeOf(5000, () => (ended += 1), clock).run();
    clock.pass(4999);
    expect(ended).toBe(0);
    clock.pass(1);
    expect(ended).toBe(1);
  });

  it('keeps what is left of it while it is stopped, and runs on from there', () => {
    const clock = standIn();
    let ended = 0;
    const life = lifeOf(5000, () => (ended += 1), clock);
    life.run();
    clock.pass(3000);
    life.stop();
    clock.pass(60_000);
    expect(ended).toBe(0);
    life.run();
    clock.pass(1999);
    expect(ended).toBe(0);
    clock.pass(1);
    expect(ended).toBe(1);
  });

  it('is not run twice over, and ends only once', () => {
    const clock = standIn();
    let ended = 0;
    const life = lifeOf(1000, () => (ended += 1), clock);
    life.run();
    life.run();
    expect(clock.waiting()).toBe(1);
    clock.pass(1000);
    life.run();
    clock.pass(5000);
    expect(ended).toBe(1);
  });

  it('can be stopped when it is not running, which does nothing', () => {
    const clock = standIn();
    let ended = 0;
    const life = lifeOf(1000, () => (ended += 1), clock);
    life.stop();
    life.run();
    clock.pass(1000);
    expect(ended).toBe(1);
  });
});

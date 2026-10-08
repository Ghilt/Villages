import { describe, expect, it } from 'vitest';

import { createDownloadQueue } from './reliefQueue';

/** A queue whose downloads land when the test says, and a record of what it started, cancelled and was told. */
function harness(most: number) {
  const started: string[] = [];
  const cancelled: string[] = [];
  const told: string[] = [];
  const pending = new Map<string, { land: () => void; fail: () => void }>();
  const queue = createDownloadQueue<string>({
    most,
    load: (key, signal) =>
      new Promise<string>((land, fail) => {
        started.push(key);
        signal.addEventListener('abort', () => {
          cancelled.push(key);
          fail(new Error('aborted'));
        });
        pending.set(key, { land: () => land(`heights of ${key}`), fail: () => fail(new Error('404')) });
      }),
    landed: (key, value) => told.push(`${key}: ${value}`),
    failed: (key) => told.push(`${key} failed`),
  });
  const settle = () => new Promise((done) => setTimeout(done, 0));
  return { queue, started, cancelled, told, pending, settle };
}

describe('the relief’s downloads', () => {
  it('start the most wanted first, no more than so many at once', () => {
    const { queue, started } = harness(2);
    queue.want(['a', 'b', 'c', 'd']);
    expect(started).toEqual(['a', 'b']);
    expect(queue.going).toBe(2);
  });

  it('start the next wanted as one lands, and never one that has landed again', async () => {
    const { queue, started, told, pending, settle } = harness(2);
    queue.want(['a', 'b', 'c']);
    pending.get('a')!.land();
    await settle();
    expect(told).toEqual(['a: heights of a']);
    expect(started).toEqual(['a', 'b', 'c']);
    pending.get('b')!.fail();
    await settle();
    expect(told).toEqual(['a: heights of a', 'b failed']);
    expect(started).toEqual(['a', 'b', 'c']);
  });

  it('cancel what is no longer wanted, never say how it ended, and start what is wanted now in its place', async () => {
    const { queue, started, cancelled, told, settle } = harness(2);
    queue.want(['a', 'b', 'c']);
    queue.want(['x', 'b']);
    await settle();
    expect(cancelled).toEqual(['a']);
    expect(started).toEqual(['a', 'b', 'x']);
    expect(told).toEqual([]);
    expect(queue.going).toBe(2);
  });

  it('never start one dropped while it waited', () => {
    const { queue, started } = harness(1);
    queue.want(['a', 'b', 'c']);
    queue.want(['a', 'c']);
    expect(started).toEqual(['a']);
  });

  it('can ask for one again after cancelling it, and hear only of the second', async () => {
    const { queue, started, told, pending, settle } = harness(1);
    queue.want(['a']);
    queue.want([]);
    queue.want(['a']);
    expect(started).toEqual(['a', 'a']);
    pending.get('a')!.land();
    await settle();
    expect(told).toEqual(['a: heights of a']);
  });
});

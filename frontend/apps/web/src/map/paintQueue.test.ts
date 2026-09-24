import { describe, expect, it } from 'vitest';

import { PaintQueue, leastLoaded } from './paintQueue';
import type { QueuedJob } from './paintQueue';

/** A tile somebody wants. Every one is the same zoom unless a test says otherwise. */
const job = (key: string, zoom = 8): QueuedJob => ({ key, zoom, state: 'waiting', wantedBy: 1 });

/** Everything the queue will start, given painters that never finish, as `key@painter`. */
function drain(queue: PaintQueue<QueuedJob>, loads: number[]): string[] {
  const started: string[] = [];
  for (let next = queue.next(loads); next !== null; next = queue.next(loads)) {
    loads[next.painter] = (loads[next.painter] ?? 0) + 1;
    started.push(`${next.job.key}@${next.painter}`);
  }
  return started;
}

describe('which tile is painted next', () => {
  it('is the coarsest waiting, because one coarse tile stands in for a whole screen of fine ones', () => {
    const queue = new PaintQueue(1);
    queue.enqueue(job('sharp', 9));
    queue.enqueue(job('coarse', 5));
    queue.enqueue(job('sharper', 10));
    queue.enqueue(job('middling', 7));
    expect(drain(queue, [0, 0, 0, 0]).map((started) => started.split('@')[0])).toEqual([
      'coarse',
      'middling',
      'sharp',
      'sharper',
    ]);
  });

  it('is the newest of the same zoom, because on a zoom out that is the level being stopped at', () => {
    const queue = new PaintQueue(1);
    for (const key of ['z9', 'z8', 'z7', 'z6']) {
      queue.enqueue(job(key));
    }
    expect(queue.next([0])?.job.key).toBe('z6');
  });

  it('goes to whichever painter has least in hand', () => {
    expect(leastLoaded([2, 0, 1])).toBe(1);
    expect(leastLoaded([1, 1, 1])).toBe(0);
  });

  it('never gives a painter more than the depth, so abandoned work stays bounded', () => {
    const queue = new PaintQueue(2);
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      queue.enqueue(job(key));
    }
    const loads = [0, 0];
    const started = drain(queue, loads);
    expect(started).toHaveLength(4);
    expect(loads).toEqual([2, 2]);
    expect(queue.anyWaiting).toBe(true);
  });
});

describe('giving up on a tile', () => {
  it('drops it unpainted when the last request gives up before a painter has it', () => {
    const queue = new PaintQueue(1);
    const stale = job('z9');
    queue.enqueue(stale);
    queue.enqueue(job('z4'));

    expect(queue.giveUp(stale)).toBe(true);
    expect(queue.has('z9')).toBe(false);
    // Nothing is left to start but the one still wanted.
    expect(drain(queue, [0, 0])).toEqual(['z4@0']);
  });

  it('keeps it while any other request still wants it', () => {
    const queue = new PaintQueue(1);
    const shared = { ...job('z6'), wantedBy: 2 };
    queue.enqueue(shared);

    expect(queue.giveUp(shared)).toBe(false);
    expect(queue.next([0])?.job.key).toBe('z6');
  });

  it('never drops one a painter already has, because it is going to be painted anyway', () => {
    const queue = new PaintQueue(1);
    const started = job('z5');
    queue.enqueue(started);
    queue.next([0]);

    expect(started.state).toBe('painting');
    expect(queue.giveUp(started)).toBe(false);
    expect(queue.has('z5')).toBe(true);
  });

  it('never drops a speculative one either, which goes straight to a painter', () => {
    const queue = new PaintQueue(1);
    const ahead = { ...job('z3'), wantedBy: 0 };
    queue.track(ahead);
    // MapLibre asks for it after all, and then gives up on it again.
    ahead.wantedBy += 1;
    expect(queue.giveUp(ahead)).toBe(false);
    expect(queue.has('z3')).toBe(true);
  });
});

describe('a finished tile', () => {
  it('is forgotten, so asking for it again starts afresh rather than joining something gone', () => {
    const queue = new PaintQueue(1);
    const done = job('z2');
    queue.enqueue(done);
    queue.next([0]);
    queue.finish(done);
    expect(queue.find('z2')).toBeUndefined();
  });

  it('does not forget a newer job that has since taken its place', () => {
    const queue = new PaintQueue(1);
    const first = job('z2');
    queue.enqueue(first);
    queue.giveUp(first);
    const second = job('z2');
    queue.enqueue(second);
    queue.finish(first);
    expect(queue.find('z2')).toBe(second);
  });
});

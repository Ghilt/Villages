import type { ScatteredPoint } from '@villages/world';

import { note } from '../../log/log';
import { createCutting } from './cellCutting';
import type { CutReply, CutRequest } from './cellCutting';

/**
 * Where the page has its cells cut: in the scenery's worker (`sceneryWorker.ts`), or on the page itself where there is
 * no worker to be had - in the tests, or once the worker has failed - by the very same cutting. Only the wiring is
 * here; what a cell is cut into is `cellCutting.ts`.
 */

let worker: Worker | null = null;
let broken = typeof Worker === 'undefined';
let here: ReturnType<typeof createCutting> | null = null;
let next = 0;
const waiting = new Map<number, { request: CutRequest; settle: (points: ScatteredPoint[]) => void }>();

function onThePage(): ReturnType<typeof createCutting> {
  here ??= createCutting();
  return here;
}

/** A reply's points; none for a cell that failed, which is said in the log, as the worker's are. */
function settled(reply: CutReply): ScatteredPoint[] {
  if ('error' in reply) {
    note('scenery', `a cell failed to cut: ${reply.error}`);
    return [];
  }
  return reply.points;
}

/** The worker, started the first time a cell is asked for; null once it has failed, when the page cuts instead. */
function theWorker(): Worker | null {
  if (broken) return null;
  if (worker !== null) return worker;
  worker = new Worker(new URL('./sceneryWorker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<CutReply>) => {
    const one = waiting.get(event.data.id);
    waiting.delete(event.data.id);
    one?.settle(settled(event.data));
  });
  worker.addEventListener('error', (event) => {
    note('scenery', `the scenery's worker failed, so the page cuts its cells itself: ${event.message}`);
    broken = true;
    worker?.terminate();
    worker = null;
    // Whatever it held is cut here instead.
    for (const [, one] of waiting) {
      void onThePage().answer(one.request).then(settled).then(one.settle);
    }
    waiting.clear();
  });
  return worker;
}

/** A cell's points, cut from the records of the tiles it reads. */
export function cutInWorker(request: Omit<CutRequest, 'id'>): Promise<ScatteredPoint[]> {
  next += 1;
  const asked: CutRequest = { ...request, id: next };
  const cutter = theWorker();
  if (cutter === null) {
    return onThePage().answer(asked).then(settled);
  }
  return new Promise((settle) => {
    waiting.set(asked.id, { request: asked, settle });
    cutter.postMessage(asked);
  });
}

/** Where the cells are cut: in the worker, or on the page where there is none or it has failed. */
export function cuttingIn(): 'in the worker' | 'on the page' {
  return broken ? 'on the page' : 'in the worker';
}

/** Whatever the cutting holds is thrown away, wherever it runs. For a change that makes every cell wrong. */
export function forgetCutting(): void {
  here?.forget();
  worker?.postMessage('forget');
}

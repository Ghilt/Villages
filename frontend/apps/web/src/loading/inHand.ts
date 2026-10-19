import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

/**
 * What the page is still fetching or making that the loading screen waits for, each said in a few words: the
 * pictures the scenery is drawn from, the canvas the sprites stand on. Anything that would otherwise pop in a
 * moment after the screen has lifted says it is in hand here and says when it is done.
 *
 * The painted tiles are not here: the map knows its own tiles, and says when it has nothing left to draw.
 */
export interface InHand {
  /** What is in hand, in the order it was begun; the same work begun twice is here twice. */
  readonly works: readonly string[];
}

const inHand = createStore<InHand>({ works: [] });

export const inHandStore: Readable<InHand> = inHand;

/** Says that `what` is in hand. Call what it returns once it is done, however it ended; a second call does nothing. */
export function begin(what: string): () => void {
  inHand.set({ works: [...inHand.get().works, what] });
  let ended = false;
  return () => {
    if (ended) {
      return;
    }
    ended = true;
    const works = [...inHand.get().works];
    works.splice(works.indexOf(what), 1);
    inHand.set({ works });
  };
}

/** Holds `what` in hand until `work` has settled, and hands `work` back. */
export function whileInHand<T>(what: string, work: Promise<T>): Promise<T> {
  const done = begin(what);
  return work.finally(done);
}

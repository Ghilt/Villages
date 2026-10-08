/**
 * The relief's downloads (decision record 0090): a few at a time, the most wanted first, and told every frame
 * what the view wants now, so that a download for a place the view has moved on from is dropped before it holds
 * up one for where the view is, and one already on its way is cancelled. Without it every tile the view had
 * ever wanted was asked for at once, and after a drag the tiles for where it stopped waited behind the tiles for
 * everywhere it had passed.
 */
export interface DownloadQueue {
  /** What is wanted now, most wanted first; anything else waiting or on its way is let go of. */
  want(keys: readonly string[]): void;
  /** How many are on their way. */
  readonly going: number;
}

export interface Downloads<Value> {
  /** At most this many on their way at once. */
  most: number;
  load(key: string, signal: AbortSignal): Promise<Value>;
  landed(key: string, value: Value): void;
  failed(key: string, error: unknown): void;
}

export function createDownloadQueue<Value>(downloads: Downloads<Value>): DownloadQueue {
  const going = new Map<string, AbortController>();
  let waiting: readonly string[] = [];

  const finish = (key: string, control: AbortController, then: () => void) => {
    if (control.signal.aborted) {
      // Let go of: nobody is waiting for it, and a newer one for the same key may be on its way.
      return;
    }
    going.delete(key);
    waiting = waiting.filter((one) => one !== key);
    then();
    pump();
  };

  const start = (key: string) => {
    const control = new AbortController();
    going.set(key, control);
    downloads.load(key, control.signal).then(
      (value) => finish(key, control, () => downloads.landed(key, value)),
      (error: unknown) => finish(key, control, () => downloads.failed(key, error)),
    );
  };

  const pump = () => {
    for (const key of waiting) {
      if (going.size >= downloads.most) {
        return;
      }
      if (!going.has(key)) {
        start(key);
      }
    }
  };

  return {
    want(keys) {
      waiting = keys;
      const wanted = new Set(keys);
      for (const [key, control] of going) {
        if (!wanted.has(key)) {
          control.abort();
          going.delete(key);
        }
      }
      pump();
    },
    get going() {
      return going.size;
    },
  };
}

/**
 * How long a toast stays, and the clock it is kept by: long enough to read what it says and longer for
 * more, and stopped while the pointer or the keyboard is on it, so it is never taken away from someone
 * reading it. Kept apart from the toast so that it is a test. See docs/UI-COMPONENTS.md.
 */

/** The least a toast stays, and the most, in milliseconds. */
export const LEAST_MS = 5000;
export const MOST_MS = 12000;

/** How long a toast of this many letters stays: two seconds and sixty milliseconds a letter, from five to twelve. */
export function stayOf(letters: number): number {
  return Math.min(MOST_MS, Math.max(LEAST_MS, 2000 + letters * 60));
}

/** What a life keeps time by: `setTimeout`, `clearTimeout` and the time now, or a stand-in for them. */
export interface Clock {
  readonly set: (then: () => void, ms: number) => unknown;
  readonly clear: (handle: unknown) => void;
  readonly now: () => number;
}

export interface Life {
  /** Its time runs, from wherever it was stopped. */
  run(): void;
  /** Its time stops, and what is left of it is kept. */
  stop(): void;
}

/** A life of `ms` that calls `over` once it has all run, however often it is stopped and run again. */
export function lifeOf(ms: number, over: () => void, clock: Clock): Life {
  let left = ms;
  let since: number | null = null;
  let pending: unknown = null;
  let ended = false;
  return {
    run() {
      if (since !== null || ended) {
        return;
      }
      since = clock.now();
      pending = clock.set(
        () => {
          since = null;
          ended = true;
          over();
        },
        Math.max(left, 0),
      );
    },
    stop() {
      if (since === null) {
        return;
      }
      clock.clear(pending);
      left -= clock.now() - since;
      since = null;
    },
  };
}

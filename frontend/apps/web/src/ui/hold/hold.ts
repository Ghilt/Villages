/**
 * Hold to confirm's rule: a button for what cannot be undone does it only when it has been held down for
 * the whole of a while, and a press let go before then does nothing at all. Kept apart from the button,
 * on a clock that can be stood in for, so that the rule is a test.
 */

/** How long it is held, in milliseconds: long enough not to happen by a slip, short enough not to irk. */
export const HOLD_MS = 1200;

/** What a hold keeps time by: `setTimeout` and `clearTimeout`, or a stand-in for them. */
export interface Clock {
  readonly set: (then: () => void, ms: number) => unknown;
  readonly clear: (handle: unknown) => void;
}

export interface Hold {
  /** It is pressed: a hold begins, unless one is already under way. */
  start(): void;
  /** It is let go: a hold not yet done comes to nothing. */
  stop(): void;
}

/** A hold that calls `done` once it has lasted `holdMs`, and never for one let go sooner. */
export function holdOf(holdMs: number, done: () => void, clock: Clock): Hold {
  let pending: unknown = null;
  return {
    start() {
      if (pending !== null) {
        return;
      }
      pending = clock.set(() => {
        pending = null;
        done();
      }, holdMs);
    },
    stop() {
      if (pending !== null) {
        clock.clear(pending);
        pending = null;
      }
    },
  };
}

/** Whether a key is one a button is pressed by from the keyboard. */
export const isPressKey = (key: string): boolean => key === ' ' || key === 'Enter';

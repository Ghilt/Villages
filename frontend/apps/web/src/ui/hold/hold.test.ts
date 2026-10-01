import { describe, expect, it } from 'vitest';

import { HOLD_MS, holdOf, isPressKey } from './hold';
import type { Clock } from './hold';

/** A clock that keeps what it is asked to do until it is told the time has come. */
function standIn(): Clock & { pending: number; come: () => void } {
  const waiting = new Map<number, () => void>();
  let next = 0;
  return {
    set: (then) => {
      next += 1;
      waiting.set(next, then);
      return next;
    },
    clear: (handle) => {
      waiting.delete(handle as number);
    },
    get pending() {
      return waiting.size;
    },
    come: () => {
      const due = [...waiting.values()];
      waiting.clear();
      for (const then of due) {
        then();
      }
    },
  };
}

describe('hold to confirm', () => {
  it('does it once the hold has lasted its whole time', () => {
    const clock = standIn();
    let done = 0;
    holdOf(HOLD_MS, () => (done += 1), clock).start();
    expect(done).toBe(0);
    clock.come();
    expect(done).toBe(1);
  });

  it('does nothing for a press let go before the end', () => {
    const clock = standIn();
    let done = 0;
    const hold = holdOf(HOLD_MS, () => (done += 1), clock);
    hold.start();
    hold.stop();
    clock.come();
    expect(done).toBe(0);
  });

  it('is not begun twice by a press that is already holding it', () => {
    const clock = standIn();
    const hold = holdOf(HOLD_MS, () => undefined, clock);
    hold.start();
    hold.start();
    expect(clock.pending).toBe(1);
  });

  it('is pressed from the keyboard by Space or Enter, and nothing else', () => {
    expect(isPressKey(' ')).toBe(true);
    expect(isPressKey('Enter')).toBe(true);
    expect(isPressKey('a')).toBe(false);
  });
});

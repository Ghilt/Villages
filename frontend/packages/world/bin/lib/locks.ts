import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';

/**
 * A lock held as a file only one process can make, with its date kept fresh while it is held: what keeps two runs
 * of `world:ready` from building one world cache entry together, the quick start and the debug panel of one tree
 * from making its world at once, and the machine from decoding two masters of two gigabytes at the same moment
 * (decision record 0095).
 *
 * A lock is let go of when its holder stops; one whose date has not moved for a minute belonged to a run that was
 * killed, and is taken. Not a process number, which Windows gives out again.
 */

const STALE_MS = 60_000;
const FRESHEN_MS = 10_000;

export interface Held {
  /** What the lock says about whoever holds it, and the path of its file. */
  readonly by: string;
  readonly path: string;
  release(): void;
}

/** Who holds the lock at `path`, or undefined when nobody does or its holder has gone. */
export function heldBy(path: string): string | undefined {
  try {
    if (Date.now() - statSync(path).mtimeMs > STALE_MS) {
      return undefined;
    }
    return readFileSync(path, 'utf8').trim() || 'somebody';
  } catch {
    return undefined;
  }
}

/** Takes the lock at `path` now, or returns undefined when somebody else holds it. */
export function tryLock(path: string, by: string): Held | undefined {
  mkdirSync(dirname(path), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, 'wx');
      writeSync(fd, by);
      closeSync(fd);
      const freshen = setInterval(() => {
        try {
          const now = new Date();
          utimesSync(path, now, now);
        } catch {
          // Taken from under us after all; nothing to keep fresh.
        }
      }, FRESHEN_MS);
      freshen.unref();
      let held = true;
      return {
        by,
        path,
        release() {
          if (!held) return;
          held = false;
          clearInterval(freshen);
          try {
            unlinkSync(path);
          } catch {
            // Already gone.
          }
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
      if (heldBy(path) !== undefined) {
        return undefined;
      }
      // Its holder stopped without letting go: the lock is taken over.
      try {
        unlinkSync(path);
      } catch {
        // Somebody else took it over first, and the second attempt finds out.
      }
    }
  }
  return undefined;
}

/** Waits for the lock at `path`, saying once who holds it, and gives up after `patienceMs`. */
export async function lock(
  path: string,
  by: string,
  options: { patienceMs?: number; waiting?: (holder: string) => void } = {},
): Promise<Held> {
  const until = Date.now() + (options.patienceMs ?? 30 * 60_000);
  let said = false;
  for (;;) {
    const held = tryLock(path, by);
    if (held !== undefined) {
      return held;
    }
    if (!said) {
      options.waiting?.(heldBy(path) ?? 'somebody');
      said = true;
    }
    if (Date.now() > until) {
      throw new Error(`gave up waiting for ${path}, held by ${heldBy(path) ?? 'somebody'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

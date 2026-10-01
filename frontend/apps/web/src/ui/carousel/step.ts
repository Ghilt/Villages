/**
 * Where a carousel goes: one along or back, round from the last to the first when it wraps and held at
 * the end when it does not, a key read as a step, and a finger's drag read as a swipe or as nothing.
 * Kept apart from the carousel so that each is a test. See docs/UI-COMPONENTS.md.
 */

/** The one `by` along from `at`, of `count`: round past either end when it wraps, held at the end when not. */
export function stepOf(at: number, by: number, count: number, wrap: boolean): number {
  if (count <= 0) {
    return 0;
  }
  const to = at + by;
  return wrap ? ((to % count) + count) % count : Math.min(Math.max(to, 0), count - 1);
}

/** Where a key takes it: the arrows one back or along, Home and End to the ends; null for any other key. */
export function keyStepOf(key: string, at: number, count: number, wrap: boolean): number | null {
  switch (key) {
    case 'ArrowLeft':
      return stepOf(at, -1, count, wrap);
    case 'ArrowRight':
      return stepOf(at, 1, count, wrap);
    case 'Home':
      return 0;
    case 'End':
      return Math.max(count - 1, 0);
    default:
      return null;
  }
}

/** How far across a drag has to go to be a swipe: a fifth of the carousel, and never less than this. */
export const SWIPE_LEAST = 32;

/**
 * What a drag across the carousel says: one along for a swipe to the left, one back for a swipe to the
 * right, and nothing for one too short, or one that went more down than across - a page being scrolled.
 */
export function swipeOf(across: number, down: number, width: number): -1 | 0 | 1 {
  const enough = Math.max(SWIPE_LEAST, width / 5);
  if (Math.abs(across) < enough || Math.abs(across) < Math.abs(down) * 1.5) {
    return 0;
  }
  return across < 0 ? 1 : -1;
}

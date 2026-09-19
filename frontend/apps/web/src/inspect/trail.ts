import { note } from '../debug/log';
import { keyOf, sameSubject, type Subject } from './subjects';

/**
 * The trail: what the player has looked at, newest first.
 *
 * Distinct from `subjects.ts`, which holds what is **open**, at most three of them, and forgets a window the
 * moment it is closed. This is what was looked at whether or not it still is, and it is the whole content of
 * the **navigation** pane's Recent section.
 *
 * **It survives a reload**, which nothing else on the stage does. `ARCHITECTURE.md` says why in one line - a
 * trail that empties itself is not a trail - and the line is right: where the panes are is where the player
 * is, and coming back to the same place is what a layout should not remember; where the player has *been* is
 * the opposite, and losing it on every refresh would make the Recent section a list of one thing.
 *
 * A module with a listener set, like the gateway, the areas, the subjects and the bays.
 */

/** A thing that was looked at, and what the window on it called it at the time. */
export interface Step {
  subject: Subject;
  /**
   * What it was called when it was looked at.
   *
   * Kept rather than looked up, because the trail outlives what it points at: a house that has left the
   * cells this page holds has no name to look up, and "a house" is not a way back to anything.
   */
  name: string;
  /** When it was last looked at, so the list can say how long ago without asking the clock twice. */
  at: number;
}

/**
 * How many steps back the trail goes.
 *
 * Longer than the three windows that fit, because the point of it is the ones that no longer fit; short
 * enough that the Recent section is read rather than scrolled.
 */
export const TRAIL_KEEPS = 12;

const KEY = 'villages.trail';

function readStored(): readonly Step[] {
  try {
    const held: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(held)) {
      return [];
    }
    // Anything that is not a step is dropped rather than trusted: this is the one thing on the stage that
    // comes back from a previous page load, and the shape of a Subject has changed once already.
    return held.filter(
      (step: unknown): step is Step =>
        typeof step === 'object' &&
        step !== null &&
        typeof (step as Step).name === 'string' &&
        typeof (step as Step).at === 'number' &&
        ((step as Step).subject?.kind === 'house' || (step as Step).subject?.kind === 'area') &&
        typeof (step as Step).subject?.id === 'string',
    );
  } catch {
    // A browser that will not remember is not a failure. The trail is a convenience, not state.
    return [];
  }
}

function store(steps: readonly Step[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(steps));
  } catch {
    // Not remembering it is a smaller problem than not showing it.
  }
}

let state: readonly Step[] = readStored();
const listeners = new Set<() => void>();

export function trailNow(): readonly Step[] {
  return state;
}

export function watchTrail(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function settle(steps: readonly Step[]): void {
  state = steps;
  store(steps);
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Record that a thing was looked at, or move it back to the front if it already was.
 *
 * Called by the window rather than by whatever opened it, because the name is a thing only the window knows:
 * it is the description's, and a description is what turns a subject into words. Looking at the same thing
 * twice is one step, not two - a trail that repeats itself is a trail with less in it.
 */
export function remember(subject: Subject, name: string): void {
  const already = state.find((step) => sameSubject(step.subject, subject));
  if (already !== undefined && already.name === name && state[0] === already) {
    return;
  }

  const rest = state.filter((step) => !sameSubject(step.subject, subject));
  const steps = [{ subject, name, at: Date.now() }, ...rest].slice(0, TRAIL_KEEPS);
  settle(steps);

  if (already === undefined) {
    note('trail', `${name} added, ${steps.length} of ${TRAIL_KEEPS} remembered`);
  }
}

/** Drop a thing from the trail, for when it has stopped existing rather than merely gone out of view. */
export function forget(subject: Subject): void {
  if (state.some((step) => sameSubject(step.subject, subject))) {
    settle(state.filter((step) => !sameSubject(step.subject, subject)));
  }
}

/** Empty it. The player's own, so it says so in the log. */
export function clearTrail(): void {
  if (state.length > 0) {
    note('trail', `all ${state.length} forgotten`);
    settle([]);
  }
}

/** What a step is keyed by in a list. */
export function stepKey(step: Step): string {
  return keyOf(step.subject);
}

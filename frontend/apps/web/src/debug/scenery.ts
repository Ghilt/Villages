import { note } from './log';

/**
 * Whether the world is furnished, and how thickly.
 *
 * The same shape as `seeEverything.ts` and every other switch in the panel: a module with a set of
 * listeners, read through `useSyncExternalStore`. Adam's, not a player's - scenery is being tried out,
 * and what it costs is the question. See decision record 0023.
 */

export interface ScenerySettings {
  on: boolean;
  /**
   * How far apart the points of the scattering are, in world units. Smaller is denser, and the count
   * goes as the square of it: halving this is four times the scenery.
   */
  spacing: number;
  /** How much later than its natural zoom each kind arrives, in zoom levels. */
  laterBy: number;
}

const START: ScenerySettings = { on: true, spacing: 2, laterBy: 0 };

let settings: ScenerySettings = { ...START };
const listeners = new Set<() => void>();

export function sceneryNow(): ScenerySettings {
  return settings;
}

export function watchScenery(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setScenery(change: Partial<ScenerySettings>): void {
  const next = { ...settings, ...change };
  if (next.on === settings.on && next.spacing === settings.spacing && next.laterBy === settings.laterBy) {
    return;
  }
  if (next.on !== settings.on) {
    note('scenery', next.on ? 'furnishing the world' : 'bare ground');
  }
  if (next.spacing !== settings.spacing) {
    // Said as the thing that is felt, which is how much of it there is, not the number behind it.
    const times = (settings.spacing / next.spacing) ** 2;
    note('scenery', `a point every ${next.spacing} world units, ${times.toFixed(2)} times as much`);
  }
  if (next.laterBy !== settings.laterBy) {
    note('scenery', `arriving ${next.laterBy.toFixed(1)} zoom levels later`);
  }
  settings = next;
  for (const listener of listeners) {
    listener();
  }
}

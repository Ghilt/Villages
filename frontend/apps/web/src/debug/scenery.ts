import { note } from './log';

/**
 * Whether the world is furnished, and how thickly.
 *
 * The same shape as `seeEverything.ts` and every other switch in the panel: a module with a set of
 * listeners, read through `useSyncExternalStore`. Adam's, not a player's. See decision record 0023.
 *
 * The density here is a **multiplier on what the sprite map asked for**, not a spacing. That is the
 * change experiment 0006's levers did not survive: how thick a wood is is now the generator's answer,
 * biome by biome, and this is the one dial over the top of it - so that a look can be tried at half or
 * at double without regenerating a world to see it.
 */

export interface ScenerySettings {
  on: boolean;
  /** One is exactly what `world/biomes.json` asked for. A half is half of it, two is twice. */
  dial: number;
  /** How much later than its natural zoom each kind arrives, in zoom levels. */
  laterBy: number;
}

const START: ScenerySettings = { on: true, dial: 1, laterBy: 0 };

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
  if (next.on === settings.on && next.dial === settings.dial && next.laterBy === settings.laterBy) {
    return;
  }
  if (next.on !== settings.on) {
    note('scenery', next.on ? 'furnishing the world' : 'bare ground');
  }
  if (next.dial !== settings.dial) {
    note(
      'scenery',
      next.dial === 1
        ? 'as thick as the sprite map asked for'
        : `${next.dial} times what the sprite map asked for`,
    );
  }
  if (next.laterBy !== settings.laterBy) {
    note('scenery', `arriving ${next.laterBy.toFixed(1)} zoom levels later`);
  }
  settings = next;
  for (const listener of listeners) {
    listener();
  }
}

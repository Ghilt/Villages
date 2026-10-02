import { note } from '../../log/log';

/**
 * Whether the world is furnished, and how thickly.
 *
 * A module with a set of listeners, read through `useSyncExternalStore`, as every switch is. The Scenery
 * section of the debug panel sets it and the sprites read it, and nothing a player does moves it: without the
 * panel the world is furnished as `world/biomes.json` asks. See decision record 0023.
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
  /**
   * A multiplier on every kind's `apart`: one is what `world/biomes.json` says, nought is the scatter as it
   * was before experiment 0012, where two trees could land on the same spot.
   */
  spacing: number;
  /**
   * How dark the scenery's shadows are, nought to one: nought draws none, and costs nothing. Each is its
   * sprite's outline laid on the ground, all of them in one layer under the trees. Experiment 0013.
   */
  shadows: number;
}

const START: ScenerySettings = { on: true, dial: 1, laterBy: 0, spacing: 1, shadows: 0.4 };

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
  if (
    next.on === settings.on &&
    next.dial === settings.dial &&
    next.laterBy === settings.laterBy &&
    next.spacing === settings.spacing &&
    next.shadows === settings.shadows
  ) {
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
  if (next.spacing !== settings.spacing) {
    note(
      'scenery',
      next.spacing === 0
        ? 'spaced by nothing: trees may stand on top of each other, as before experiment 0012'
        : next.spacing === 1
          ? 'spaced as world/biomes.json says'
          : `spaced ${next.spacing} times as far apart as world/biomes.json says`,
    );
  }
  if (next.shadows !== settings.shadows) {
    note(
      'scenery',
      next.shadows === 0
        ? 'no shadows: the trees stand on bare ground'
        : `shadows at ${Math.round(next.shadows * 100)} per cent, in one layer under the trees`,
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

import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';

/**
 * The numbers of a land motion that Adam moves with the sliders of its fold in the Land part of the debug panel's
 * Shaders section. Remembered in this browser, and said once in the log after a slider stops, as `<name> tuned: …`,
 * so the log's copy button carries them to whoever is to write them down. A way of looking, never sent.
 */
export interface Tuning<T extends object> {
  store: Readable<T>;
  set(change: Partial<T>): void;
  reset(): void;
}

export function createTuning<T extends { [K in keyof T]: number } & object>(
  kept: string,
  defaults: T,
  name: string,
): Tuning<T> {
  function remembered(): T {
    try {
      const held = localStorage.getItem(kept);
      if (held === null) {
        return defaults;
      }
      // Only the numbers there are now: one remembered from an older set of sliders is dropped.
      const parsed = JSON.parse(held) as Record<string, unknown>;
      const known = Object.fromEntries(
        Object.keys(defaults)
          .filter((key) => typeof parsed[key] === 'number')
          .map((key) => [key, parsed[key]]),
      );
      return { ...defaults, ...known };
    } catch {
      return defaults;
    }
  }

  const tuning = createStore<T>(remembered());
  let saying: ReturnType<typeof setTimeout> | null = null;

  function set(change: Partial<T>): void {
    tuning.set(change);
    try {
      localStorage.setItem(kept, JSON.stringify(tuning.get()));
    } catch {
      // Not remembered across a reload, then; still in force until one.
    }
    if (saying !== null) {
      clearTimeout(saying);
    }
    saying = setTimeout(() => {
      saying = null;
      const said = Object.entries<number>(tuning.get())
        .map(([key, value]) => `${key} ${Number(value.toFixed(2))}`)
        .join(', ');
      note('land', `${name} tuned: ${said}`);
    }, 700);
  }

  return { store: tuning, set, reset: () => set(defaults) };
}

import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';
import type { ShaderLevel } from '../../shaders/levels';

import { CRITTERS_LOOK } from './look';

/**
 * How this window draws the critters: their level, off, low or high, low at every load, and what is about at this
 * moment, for the Critters part. A way of looking, neither remembered nor sent. Stores, the one shape every
 * piece of state the page watches takes.
 */
const critters = createStore<{ level: ShaderLevel }>({ level: 'low' });

export const critterStore: Readable<{ level: ShaderLevel }> = critters;

export function setCritterLevel(level: ShaderLevel): void {
  if (level === critters.get().level) {
    return;
  }
  note(
    'critters',
    level === 'off'
      ? 'off: no critters'
      : `${level}: the critters move at ${CRITTERS_LOOK.levels[level].framesPerSecond} frames a second`,
  );
  critters.set({ level });
}

/** How many of each kind are on the screen, by kind, and why there are none when there are none. */
export interface CritterReading {
  about: Readonly<Record<string, number>>;
  /** Null while some are drawn or could be; otherwise what keeps them away, in a few words. */
  none: string | null;
}

const reading = createStore<CritterReading>({ about: {}, none: 'not yet drawn' });

/** What is about, said inside the Critters part. Set only when it changes, never every frame. */
export const critterReadingStore: Readable<CritterReading> = reading;

export function readCritters(about: Readonly<Record<string, number>>, none: string | null): void {
  const was = reading.get();
  if (was.none !== none || JSON.stringify(was.about) !== JSON.stringify(about)) {
    reading.set({ about, none });
  }
}

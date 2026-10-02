import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

/**
 * A log the running program can write to and a human can read off the screen.
 *
 * The console is fine for a developer and useless for anyone else: it cannot be read at a glance, it
 * cannot be copied without a browser's devtools, and it is gone on a reload. This exists so that Adam can
 * see what the program thinks is happening and paste it into a conversation.
 *
 * Deliberately not a store of state. State is read from the map when the panel draws; this holds only
 * things that happened, in order.
 */

export interface Note {
  at: number;
  area: string;
  message: string;
}

/** Enough to cover what just happened, not so much that copying it is unreadable. */
const MOST = 200;

const log = createStore<{ notes: readonly Note[] }>({ notes: [] });

/** The notes so far. One array a change, so that whatever reads them can tell whether anything happened. */
export const logStore: Readable<{ notes: readonly Note[] }> = log;

/**
 * Records something that happened. `area` groups the lines, so a run reads as a story from one part of
 * the program rather than as noise from all of them.
 */
export function note(area: string, message: string): void {
  const { notes } = log.get();
  const next = notes.length >= MOST ? notes.slice(notes.length - MOST + 1) : notes;
  log.set({ notes: [...next, { at: Date.now(), area, message }] });
}

/**
 * As much of an id as tells one apart from another on a screen.
 *
 * Eight characters of a UUID, which is what the panel shows of a player, a command and a story alike, so
 * that a causation id on an event and the command line that caused it read as the same thing.
 */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

/** The clock time of a note, to the second, which is the resolution anybody reads a log at. */
export function atToClock(at: number): string {
  const when = new Date(at);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(when.getHours())}:${two(when.getMinutes())}:${two(when.getSeconds())}`;
}

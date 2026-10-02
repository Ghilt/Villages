import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note, shortId } from '../log/log';

/**
 * What is being inspected, and in what order it was opened.
 *
 * A **subject** is the one thing an inspect window is about. It is a tagged identity rather than a bare id,
 * so that one window can render every kind of thing the way one parchment renders every choice: a new kind
 * of thing in the world costs a description of itself and not a component. See `MECHANICS.md`.
 *
 * This replaces the two selections that used to run side by side - `select/selection.ts` for a house and
 * `state.selected` in `areas/areas.ts` for an area - which is what the first one's own docstring said the
 * second selectable thing would cost. One store now, and whatever is newest in it is what the map marks.
 *
 * A store, like the session, the areas and the bays, read through `useStore`. Nothing here survives a reload.
 */

export type Subject =
  { kind: 'house'; id: string } | { kind: 'area'; id: string } | { kind: 'character'; id: string };

/**
 * How many can be open at once where there is room for them.
 *
 * Three because comparing two houses should not mean remembering one of them, and four in a rail down a
 * stage is a rail nobody can read. A fourth pushes the oldest off rather than being refused.
 */
export const MOST_OPEN = 3;

export interface SubjectsState {
  /** Newest first. The first is the one the map marks. */
  readonly open: readonly Subject[];
}

const NOTHING: SubjectsState = { open: [] };

const store = createStore<SubjectsState>(NOTHING);

/** What is open, newest first. */
export const subjectsStore: Readable<SubjectsState> = store;

/** The same two things, or the same thing twice. */
export function sameSubject(one: Subject | null, other: Subject | null): boolean {
  return one?.kind === other?.kind && one?.id === other?.id;
}

/** What a subject is called on the wire between these modules, and what its pane is addressed by. */
export function keyOf(subject: Subject): string {
  return `${subject.kind}:${subject.id}`;
}

/** The id of the pane that holds a window on this subject, so a bay can be asked to show it. */
export function paneIdOf(subject: Subject): string {
  return `inspect:${keyOf(subject)}`;
}

/** The subject a pane id names, or null when the pane is not an inspect window. */
export function subjectOfPane(id: string): Subject | null {
  const [head, kind, rest] = id.split(':');
  if (head !== 'inspect' || rest === undefined) {
    return null;
  }
  return kind === 'house' || kind === 'area' || kind === 'character' ? { kind, id: rest } : null;
}

/** What the map marks: the newest thing opened, because that is what the player is looking at. */
export function highlighted(): Subject | null {
  return store.get().open[0] ?? null;
}

function settle(open: readonly Subject[]): void {
  store.set({ open });
}

function saying(subject: Subject): string {
  return `${subject.kind} ${shortId(subject.id)}`;
}

/**
 * Open a window on something, or raise the one that is already open on it.
 *
 * Opening what is already open **raises** it rather than making a second window: two windows saying the
 * same thing is a bug the player would have to tidy up, and the thing they meant was "look at this one".
 */
export function openOn(subject: Subject): void {
  const already = store.get().open.findIndex((one) => sameSubject(one, subject));
  if (already === 0) {
    return;
  }

  if (already > 0) {
    const raised = [subject, ...store.get().open.filter((one) => !sameSubject(one, subject))];
    settle(raised);
    note('inspect', `${saying(subject)} raised`);
    return;
  }

  const open = [subject, ...store.get().open].slice(0, MOST_OPEN);
  const pushedOff = store.get().open.length >= MOST_OPEN ? (store.get().open[MOST_OPEN - 1] ?? null) : null;
  settle(open);
  note(
    'inspect',
    `${saying(subject)} opened${pushedOff === null ? '' : `, ${saying(pushedOff)} pushed off`}`,
  );
}

export function closeOne(subject: Subject): void {
  if (!store.get().open.some((one) => sameSubject(one, subject))) {
    return;
  }
  settle(store.get().open.filter((one) => !sameSubject(one, subject)));
  note('inspect', `${saying(subject)} closed`);
}

export function closeAll(): void {
  if (store.get().open.length === 0) {
    return;
  }
  const had = store.get().open.length;
  settle([]);
  note('inspect', `all ${had} closed`);
}

/**
 * Forget a subject that has stopped existing, without saying it was closed.
 *
 * An area the player deleted is not a window they shut; leaving it open would show a window about nothing.
 */
export function forgetSubject(subject: Subject): void {
  if (store.get().open.some((one) => sameSubject(one, subject))) {
    settle(store.get().open.filter((one) => !sameSubject(one, subject)));
  }
}

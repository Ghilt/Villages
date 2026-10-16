import { atToClock } from '../../log/log';
import type { Note } from '../../log/log';
import type { LogMessage, LogWindow } from '../../log/shared';

/** How many lines the page keeps of a window: more than the panel's two hundred, since it hears every one. */
export const KEPT = 2000;

/** A window of the game the page has heard from, what it said, and whether it has closed since. */
export interface HeardWindow {
  readonly window: LogWindow;
  readonly notes: readonly Note[];
  readonly gone: boolean;
}

/** Every window heard, in the order each was first heard. */
export type Heard = readonly HeardWindow[];

/** What the page holds once it has heard [message]. */
export function hear(heard: Heard, message: LogMessage): Heard {
  if (message.kind === 'ask') return heard;
  const at = heard.findIndex((one) => one.window.id === message.window.id);
  const was = at === -1 ? null : heard[at]!;
  let now: HeardWindow;
  switch (message.kind) {
    case 'notes':
      // An answer holds the window's last two hundred; what the page heard since it opened may be more.
      now = {
        window: message.window,
        notes:
          was !== null && was.notes.length > message.notes.length ? was.notes : message.notes.slice(-KEPT),
        gone: false,
      };
      break;
    case 'note':
      now = {
        window: message.window,
        notes: [...(was?.notes ?? []), message.note].slice(-KEPT),
        gone: false,
      };
      break;
    case 'gone':
      if (was === null) return heard;
      now = { ...was, gone: true };
      break;
  }
  return at === -1 ? [...heard, now] : heard.map((one, index) => (index === at ? now : one));
}

/** What the page holds once it is cleared: every window still, and nothing any of them said before. */
export function forget(heard: Heard): Heard {
  return heard.map((one) => ({ ...one, notes: [] }));
}

/** Which lines are shown: one window's or every one's, only the areas chosen or every area, and words in them. */
export interface Choice {
  readonly window: string | null;
  readonly areas: ReadonlySet<string>;
  readonly words: string;
}

/** A line of the log and the window that said it. */
export interface Line {
  readonly window: LogWindow;
  readonly note: Note;
}

/** The lines of the windows chosen, newest first; two of the same moment in the order they were said, the later first. */
function linesOf(heard: Heard, window: string | null): Line[] {
  const all = heard
    .filter((one) => window === null || one.window.id === window)
    .flatMap((one) => one.notes.map((note, index) => ({ line: { window: one.window, note }, index })));
  return all.sort((a, b) => b.line.note.at - a.line.note.at || b.index - a.index).map(({ line }) => line);
}

/** The lines the choice shows, newest first. */
export function shownLines(heard: Heard, choice: Choice): Line[] {
  const words = choice.words.trim().toLowerCase();
  return linesOf(heard, choice.window).filter(
    ({ note }) =>
      (choice.areas.size === 0 || choice.areas.has(note.area)) &&
      (words === '' || `${note.area} ${note.message}`.toLowerCase().includes(words)),
  );
}

/** Every area the chosen windows said something under, by name, and how many lines each. */
export function areasOf(heard: Heard, window: string | null): [string, number][] {
  const counted = new Map<string, number>();
  for (const { note } of linesOf(heard, window)) counted.set(note.area, (counted.get(note.area) ?? 0) + 1);
  return [...counted].sort(([a], [b]) => a.localeCompare(b));
}

/** A line as the debug panel copies it, and the window's id before it when lines of several windows are copied. */
export function lineText({ window, note }: Line, withWindow: boolean): string {
  return `${withWindow ? `${window.id} ` : ''}${atToClock(note.at)} ${note.area}: ${note.message}`;
}

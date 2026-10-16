import { logStore } from './log';
import type { Note } from './log';

/*
 * The log, shared with the logs' inspect page: every window of the game in this browser says each note it makes on a
 * channel every page of the same address hears, and answers the page's ask with every note it holds, so the page reads
 * the same lines the debug panel does, from every game window at once, and goes on reading them after one is closed.
 * Nothing leaves the browser. See `admin/logs/Logs.tsx`.
 */

/** The channel the game's windows and the logs' page share. */
export const LOG_CHANNEL = 'villages:log';

/** A window of the game, as the logs' page tells one from another. */
export interface LogWindow {
  /** Eight characters, new at every load. */
  readonly id: string;
  /** Where it was opened, `/` or `/?at=48.1,11.6&zoom=10`. */
  readonly address: string;
  readonly opened: number;
}

/** What is said on the channel. */
export type LogMessage =
  /** The logs' page asks every window for what it holds. */
  | { readonly kind: 'ask' }
  /** A window's every note: its answer to an ask, and what it says as it opens. */
  | { readonly kind: 'notes'; readonly window: LogWindow; readonly notes: readonly Note[] }
  /** One note, as the window makes it. */
  | { readonly kind: 'note'; readonly window: LogWindow; readonly note: Note }
  /** The window is closing, or loading again as a window of its own. */
  | { readonly kind: 'gone'; readonly window: LogWindow };

/**
 * Says this window's log on the channel from now on - each note as it is made, and every note it holds when the
 * logs' page asks - until the function it returns is called. A browser without the channel shares nothing.
 */
export function shareTheLog(address: string, id: string = crypto.randomUUID().slice(0, 8)): () => void {
  if (typeof BroadcastChannel !== 'function') return () => {};
  const channel = new BroadcastChannel(LOG_CHANNEL);
  const here: LogWindow = { id, address, opened: Date.now() };
  const say = (message: LogMessage) => channel.postMessage(message);
  const everything = () => say({ kind: 'notes', window: here, notes: logStore.get().notes });

  channel.onmessage = (event: MessageEvent<LogMessage>) => {
    if (event.data.kind === 'ask') everything();
  };
  // A note is always added at the end, one a change, so the last is the one just made.
  let last = logStore.get().notes.at(-1);
  const stop = logStore.watch(() => {
    const made = logStore.get().notes.at(-1);
    if (made !== undefined && made !== last) say({ kind: 'note', window: here, note: made });
    last = made;
  });
  everything();
  return () => {
    stop();
    say({ kind: 'gone', window: here });
    channel.close();
  };
}

/** Hears every game window's log until the function it returns is called, asking each first for what it holds. */
export function hearTheLog(heard: (message: LogMessage) => void): () => void {
  if (typeof BroadcastChannel !== 'function') return () => {};
  const channel = new BroadcastChannel(LOG_CHANNEL);
  channel.onmessage = (event: MessageEvent<LogMessage>) => heard(event.data);
  channel.postMessage({ kind: 'ask' } satisfies LogMessage);
  return () => channel.close();
}

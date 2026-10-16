import './logs.css';

import { useEffect, useMemo, useReducer, useState } from 'react';

import { atToClock } from '../../log/log';
import { hearTheLog } from '../../log/shared';
import { InspectPage } from '../frame/InspectPage';
import { areasOf, forget, hear, lineText, shownLines } from './heard';
import type { Heard, Line } from './heard';
import type { LogMessage } from '../../log/shared';

/**
 * The debug panel's log, on a page of its own: every line each window of the game in this browser writes, as it
 * writes it, and every line it held when the page opened, which it sends when asked. The windows across the top, each
 * by where it was opened and when, and one or all of them read at once; the areas below them, any of which can be
 * chosen to read only those; a box that keeps only the lines with a word in them; and copy, which copies what is
 * shown as the panel copies its log. It keeps more of each window than the panel does, and what a closed window said.
 * Nothing leaves the browser: see `log/shared.ts`.
 */
export function Logs() {
  const [heard, heardMore] = useReducer(
    (held: Heard, told: LogMessage | { kind: 'forget' }) =>
      told.kind === 'forget' ? forget(held) : hear(held, told),
    [],
  );
  const [chosen, chooseWindow] = useState<string | null>(null);
  const [areas, chooseAreas] = useState<ReadonlySet<string>>(new Set());
  const [words, setWords] = useState('');
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');

  useEffect(() => hearTheLog(heardMore), []);

  const lines = useMemo(
    () => shownLines(heard, { window: chosen, areas, words }),
    [heard, chosen, areas, words],
  );
  const counted = useMemo(() => areasOf(heard, chosen), [heard, chosen]);
  const several = chosen === null && heard.length > 1;

  const copy = () => {
    // A browser may refuse the clipboard: the lines are plain text on the page, and can be selected by hand.
    try {
      void navigator.clipboard.writeText(lines.map((line) => lineText(line, several)).join('\n')).then(
        () => setCopied('yes'),
        () => setCopied('failed'),
      );
    } catch {
      setCopied('failed');
    }
  };
  const toggle = (area: string) =>
    chooseAreas((chosen) => {
      const next = new Set(chosen);
      if (!next.delete(area)) next.add(area);
      return next;
    });

  return (
    <InspectPage
      title="Logs"
      bar={
        <>
          <span className="inspect-note logs-count">
            {heard.length} {heard.length === 1 ? 'window' : 'windows'}, {lines.length}{' '}
            {lines.length === 1 ? 'line' : 'lines'} shown, newest first
          </span>
          <button type="button" className="logs-button" onClick={copy}>
            {copied === 'yes' ? 'copied' : copied === 'failed' ? 'select it' : 'copy'}
          </button>
          <button type="button" className="logs-button" onClick={() => heardMore({ kind: 'forget' })}>
            clear
          </button>
        </>
      }
    >
      {heard.length === 0 ? (
        <p className="inspect-quiet logs-empty">
          No window of the game has said anything yet. Open the game at <a href="/">/</a> in this browser, and
          its log is here as it is written, with every line it wrote before.
        </p>
      ) : (
        <>
          <nav className="inspect-each logs-windows" aria-label="The windows">
            <button
              type="button"
              className={chosen === null ? 'inspect-tab is-chosen' : 'inspect-tab'}
              onClick={() => chooseWindow(null)}
            >
              every window
            </button>
            {heard.map((one) => (
              <button
                key={one.window.id}
                type="button"
                className={one.window.id === chosen ? 'inspect-tab is-chosen' : 'inspect-tab'}
                onClick={() => chooseWindow(one.window.id)}
                title={`opened at ${atToClock(one.window.opened)}, ${one.notes.length} lines held`}
              >
                {one.window.id} {one.window.address} {one.gone && <span className="logs-gone">closed</span>}
              </button>
            ))}
          </nav>
          <div className="logs-filters">
            <ul className="logs-areas" aria-label="The areas">
              {counted.map(([area, count]) => (
                <li key={area}>
                  <button
                    type="button"
                    className={areas.has(area) ? 'logs-area is-chosen' : 'logs-area'}
                    aria-pressed={areas.has(area)}
                    onClick={() => toggle(area)}
                  >
                    {area} <span className="logs-area__count">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
            <input
              type="search"
              className="logs-find"
              aria-label="Find in the log"
              placeholder="a word in a line"
              value={words}
              onChange={(event) => setWords(event.target.value)}
            />
          </div>
          <ol className="logs-list">
            {lines.length === 0 && <li className="inspect-quiet">nothing here says that</li>}
            {lines.map((line, index) => (
              // Counted from the oldest, so a line keeps its key as newer ones arrive above it.
              <LogLine key={lines.length - index} line={line} several={several} />
            ))}
          </ol>
        </>
      )}
    </InspectPage>
  );
}

function LogLine({ line, several }: { line: Line; several: boolean }) {
  return (
    <li>
      {several && <span className="logs-window">{line.window.id}</span>}
      <span className="logs-when">{atToClock(line.note.at)}</span>
      <span className="logs-area-said">{line.note.area}</span>
      {line.note.message}
    </li>
  );
}

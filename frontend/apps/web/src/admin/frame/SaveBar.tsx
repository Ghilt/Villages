import { useEffect, useState } from 'react';

import type { CatalogueEditor } from './useCatalogueEditor';

/** What the game server runs on, said in a line, as every catalogue's page says it at its head. */
function said(editor: CatalogueEditor<unknown>): { line: string; well: boolean } {
  if (editor.shelf.state === 'connecting')
    return { line: 'asking the game server what it runs on', well: true };
  if (editor.shelf.state === 'closed') {
    return { line: 'the game server is not running: reading needs nothing, saving needs it', well: false };
  }
  if (editor.runsOn === 'this') return { line: 'the game server runs on this file', well: true };
  if (editor.runsOn === 'another') {
    return {
      line: 'the game server runs on another version of this file: it refused this one, or has yet to look',
      well: false,
    };
  }
  return { line: 'the game server does not say what it runs on', well: false };
}

/**
 * The bar across the top of a catalogue's page: what the game server runs on, how many changes the page holds, and
 * the two things to do with them, save and discard, with the server's answer to the last save. Words rather than
 * marks, as every inspect page's controls are. See decision record 0097.
 */
export function SaveBar({ editor }: { editor: CatalogueEditor<unknown> }) {
  const server = said(editor);
  const blocked =
    editor.edits === 0 ||
    editor.problem !== null ||
    editor.saving ||
    editor.stale ||
    editor.shelf.state !== 'open';
  return (
    <div className="inspect-save" role="region" aria-label="Saving">
      <span className={server.well ? 'inspect-note' : 'inspect-note inspect-problem'}>{server.line}</span>
      <span className="inspect-save__changes">
        {editor.edits === 0 ? 'no changes' : `${editor.edits} ${editor.edits === 1 ? 'change' : 'changes'}`}
      </span>
      <button type="button" className="inspect-button" disabled={blocked} onClick={editor.save}>
        {editor.saving ? 'saving' : 'save'}
      </button>
      <button type="button" className="inspect-button" disabled={editor.edits === 0} onClick={editor.discard}>
        discard
      </button>
      {editor.stale && (
        <span className="inspect-problem">
          the file changed on disk since your first change: discard to read it again
        </span>
      )}
      {editor.problem !== null && (
        <span className="inspect-problem">this would not read: {editor.problem}</span>
      )}
      {editor.answer !== null &&
        (editor.answer.saved ? (
          <span className="inspect-quiet">saved, and the game server took it on</span>
        ) : (
          <span className="inspect-problem">not saved: {editor.answer.reason}</span>
        ))}
    </div>
  );
}

/**
 * The whole file as text, folded away under the table: for whatever the page has no cell for - a slot, a type added -
 * and as the page of any catalogue before it has better. Using the text makes it one change, the whole file.
 */
export function WholeFile({ editor }: { editor: CatalogueEditor<unknown> }) {
  const shown = editor.draft === null ? '' : JSON.stringify(editor.draft, null, 2);
  const [typed, setTyped] = useState(shown);
  const [wrong, setWrong] = useState<string | null>(null);
  useEffect(() => setTyped(shown), [shown]);
  return (
    <details className="inspect-whole">
      <summary>the whole file</summary>
      <textarea
        className="inspect-whole__text"
        aria-label="The whole file"
        spellCheck={false}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
      />
      <button
        type="button"
        className="inspect-button"
        disabled={typed === shown}
        onClick={() => {
          try {
            editor.set([], JSON.parse(typed));
            setWrong(null);
          } catch (unread) {
            setWrong(unread instanceof Error ? unread.message : String(unread));
          }
        }}
      >
        use this text
      </button>
      {wrong !== null && <span className="inspect-problem"> not JSON: {wrong}</span>}
    </details>
  );
}

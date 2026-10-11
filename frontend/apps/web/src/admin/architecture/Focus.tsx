import { took } from './Timeline';
import {
  LIVE,
  READERS,
  TOOLS,
  artifact,
  downstreamOf,
  makersOf,
  readersOf,
  toolsReading,
  upstreamOf,
} from './world';

/** What the chosen card is, said: where it lives, what makes it, what it depends on, what depends on it. */
export function Focus({ chosen, clear }: { chosen: string | null; clear: () => void }) {
  if (chosen === null) {
    return (
      <p className="arch__focus arch__focus--empty">
        Choose a card to see what it depends on and what depends on it; drag to move about, scroll to zoom.
      </p>
    );
  }
  const [kind, id] = [chosen.slice(0, chosen.indexOf(':')), chosen.slice(chosen.indexOf(':') + 1)];
  return (
    <section className="arch__focus" aria-live="polite">
      <button type="button" className="arch__clear" onClick={clear}>
        clear
      </button>
      {kind === 'file' && <FileFocus id={id} />}
      {kind === 'tool' && <ToolFocus script={id} />}
      {kind === 'run' && (id === 'page' || id === 'server') && <ProgramFocus program={id} />}
      {kind === 'run' && id !== 'page' && id !== 'server' && <LiveFocus id={id} />}
    </section>
  );
}

const names = (ids: Iterable<string>) => [...ids].map((id) => artifact(id).name).join(', ') || 'nothing';

function FileFocus({ id }: { id: string }) {
  const a = artifact(id);
  const up = upstreamOf(id);
  const down = downstreamOf(id);
  const runtime = readersOf(id);
  return (
    <>
      <h3 className="arch__focus-title">
        {a.name} <code>{a.path}</code> {a.size && <span>{a.size}</span>}
      </h3>
      <p>{a.what}</p>
      <dl className="arch__facts">
        <dt>made by</dt>
        <dd>
          {a.origin === 'authored'
            ? 'Adam'
            : makersOf(id)
                .map((t) => t.script)
                .join(', ') || a.origin}
        </dd>
        <dt>depends on</dt>
        <dd>{names(up.files)}</dd>
        <dt>read by tools</dt>
        <dd>
          {toolsReading(id)
            .map((t) => t.script)
            .join(', ') || 'none'}
        </dd>
        <dt>read while running</dt>
        <dd className={runtime.length > 0 ? 'arch__yes' : ''}>
          {runtime
            .map((r) => `${r.name} (${r.program === 'page' ? 'the page' : 'the game server'})`)
            .join(', ') || 'nothing reads it while the game runs'}
        </dd>
        <dt>stale when it changes</dt>
        <dd>{names(down.files)}</dd>
      </dl>
    </>
  );
}

function ToolFocus({ script }: { script: string }) {
  const tool = TOOLS.find((t) => t.script === script)!;
  const command =
    tool.group === 'adam'
      ? `node ${tool.entry.replace('scripts/', '')}  (from scripts/)`
      : `npm run ${tool.script} --prefix frontend`;
  return (
    <>
      <h3 className="arch__focus-title">
        {tool.script} <span>{took(tool)}</span>
      </h3>
      <p>{tool.what}</p>
      <dl className="arch__facts">
        <dt>run it</dt>
        <dd>
          <code>{command}</code>
        </dd>
        <dt>run by</dt>
        <dd>{tool.ranBy}</dd>
        <dt>reads</dt>
        <dd>{names(tool.reads)}</dd>
        <dt>writes</dt>
        <dd>{names(tool.writes)}</dd>
      </dl>
    </>
  );
}

function ProgramFocus({ program }: { program: 'page' | 'server' }) {
  const readers = READERS.filter((r) => r.program === program);
  const files = new Set(readers.flatMap((r) => r.reads));
  const from = new Set<string>();
  files.forEach((file) => upstreamOf(file).files.forEach((f) => from.add(f)));
  return (
    <>
      <h3 className="arch__focus-title">{program === 'page' ? 'The page' : 'The game server'}</h3>
      <dl className="arch__facts">
        <dt>reads</dt>
        <dd>{names(files)}</dd>
        <dt>which come from</dt>
        <dd>{names([...from].filter((f) => !files.has(f)))}</dd>
        <dt>read by</dt>
        <dd>{readers.map((r) => `${r.name} (${r.where})`).join(', ')}</dd>
      </dl>
    </>
  );
}

function LiveFocus({ id }: { id: string }) {
  const live = LIVE.find((l) => l.id === id)!;
  return (
    <>
      <h3 className="arch__focus-title">
        {live.name} <code>{live.where}</code>
      </h3>
      <p>{live.what}</p>
    </>
  );
}

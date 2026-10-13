import { WORLD_CACHE } from './cache';
import { took } from './Timeline';
import {
  PIECES,
  READERS,
  TALKS,
  TOOLS,
  artifact,
  downstreamOf,
  makersOf,
  readersOf,
  toolsReading,
  group,
  piece,
  upstreamOf,
} from './world';
import type { Piece } from './world';

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
      {kind === 'run' && <PieceFocus id={id} />}
      {kind === 'group' && <GroupFocus id={id} />}
      {kind === 'shelf' && <ShelfFocus />}
    </section>
  );
}

const names = (ids: Iterable<string>) => [...ids].map((id) => artifact(id).name).join(', ') || 'nothing';

/** The world cache's box: what it is, where it is, what is in it, and what fills it. */
function ShelfFocus() {
  return (
    <>
      <h3 className="arch__focus-title">
        {WORLD_CACHE.name} <code>{WORLD_CACHE.where}</code>
      </h3>
      <p>{WORLD_CACHE.what}</p>
      <dl className="arch__facts">
        <dt>filled and lent by</dt>
        <dd>
          world:ready, which the quick start and the Debug map run; world:prune clears what no tree uses
        </dd>
        <dt>the tools in it</dt>
        <dd>{WORLD_CACHE.tools.join(', ')}</dd>
        <dt>what they make</dt>
        <dd>{names(WORLD_CACHE.files)}</dd>
      </dl>
    </>
  );
}

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
        {a.development !== undefined && (
          <>
            <dt>for development</dt>
            <dd>{a.development}</dd>
          </>
        )}
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
        {tool.development !== undefined && (
          <>
            <dt>for development</dt>
            <dd>{tool.development}</dd>
          </>
        )}
      </dl>
    </>
  );
}

/** The baked files a program reads, where they come from, and which parts of it read them. */
function Reads({ program }: { program: 'page' | 'server' }) {
  const readers = READERS.filter((r) => r.program === program);
  const files = new Set(readers.flatMap((r) => r.reads));
  const from = new Set<string>();
  files.forEach((file) => upstreamOf(file).files.forEach((f) => from.add(f)));
  return (
    <>
      <dt>reads</dt>
      <dd>{names(files)}</dd>
      <dt>which come from</dt>
      <dd>{names([...from].filter((f) => !files.has(f)))}</dd>
      <dt>read by</dt>
      <dd>{readers.map((r) => `${r.name} (${r.where})`).join(', ')}</dd>
    </>
  );
}

const WHERE = {
  browser: 'in the browser',
  server: "in the game server's process",
  docker: 'in Docker, beside it',
};

/** What passes between a piece and the pieces it talks to, each way. */
function talksOf(p: Piece): string {
  return TALKS.filter((t) => t.from === p.id || t.to === p.id)
    .map((t) => {
      const other = piece(t.from === p.id ? t.to : t.from);
      const way = t.both ? '⇄' : t.from === p.id ? '→' : '←';
      return `${way} ${other.name}: ${t.says}`;
    })
    .join('; ');
}

function PieceFocus({ id }: { id: string }) {
  const p = piece(id);
  return (
    <>
      <h3 className="arch__focus-title">
        {p.name} <code>{p.where}</code>
      </h3>
      <p>{p.what}</p>
      <dl className="arch__facts">
        <dt>runs</dt>
        <dd>
          {WHERE[p.runs]}
          {p.group === undefined ? '' : `, in ${group(p.group).name.toLowerCase()}`}
          {p.yet === undefined ? '' : `; not used until increment ${p.yet}`}
          {p.instead === undefined ? '' : `; instead of ${piece(p.instead).name} when Docker is not running`}
        </dd>
        <dt>talks to</dt>
        <dd>{talksOf(p)}</dd>
        {id === 'page' && <Reads program="page" />}
      </dl>
    </>
  );
}

function GroupFocus({ id }: { id: string }) {
  const g = group(id);
  const inside = PIECES.filter((p) => p.group === id);
  return (
    <>
      <h3 className="arch__focus-title">
        {g.name} <code>{g.where}</code>
      </h3>
      <p>{g.what}</p>
      <dl className="arch__facts">
        <dt>made of</dt>
        <dd>{inside.map((p) => p.name).join(', ')}</dd>
        {id === 'server' && <Reads program="server" />}
      </dl>
    </>
  );
}

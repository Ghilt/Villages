import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';

import type { Card } from './graph';
import { took } from './Timeline';
import { PROGRAMS } from './readers';
import { LIVE, TOOLS, artifact } from './world';

/** What a card is told: which card it is, and whether it is chosen, lit by the choice, or dimmed. */
export type CardData = { card: Card; state: string };
export type CardNode = Node<CardData>;

const MADE_BY = { authored: 'by Adam', fetched: 'downloaded', baked: 'made by a tool' } as const;

/** The mark for a file, a few files, or a folder: a page with its corner folded, two of them, a folder. */
function FormMark({ form }: { form: 'file' | 'files' | 'folder' }) {
  const page = 'M3 1h7l4 4v10H3z M10 1v4h4';
  return (
    <svg className="card__mark" viewBox="0 0 18 16" aria-hidden>
      {form === 'folder' ? (
        <path d="M1 3h6l2 2h8v10H1z" />
      ) : (
        <>
          {form === 'files' && <path d="M1 3v13h10" />}
          <path d={page} transform={form === 'files' ? 'translate(2 -1)' : 'translate(1 0)'} />
        </>
      )}
    </svg>
  );
}

function Ends({ sides = false }: { sides?: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
      {/* Running cards talk to the ones beside them, so their arrows run side to side. */}
      {sides && <Handle id="left" type="target" position={Position.Left} isConnectable={false} />}
      {sides && <Handle id="right" type="source" position={Position.Right} isConnectable={false} />}
    </>
  );
}

export function FileCard({ data }: NodeProps<CardNode>) {
  const a = artifact(data.card.ref);
  return (
    <div className={`card card--file card--${a.origin} ${data.state}`}>
      <Ends />
      <div className="card__strip">
        <FormMark form={a.form} />
        <span>{a.form}</span>
        <span className="card__by">{MADE_BY[a.origin]}</span>
      </div>
      <div className="card__name">{a.name}</div>
      <code className="card__path">{a.path}</code>
      <div className="card__what">{a.what}</div>
    </div>
  );
}

export function ToolCard({ data }: NodeProps<CardNode>) {
  const tool = TOOLS.find((t) => t.script === data.card.ref)!;
  return (
    <div className={`card card--tool ${data.state}`}>
      <Ends />
      <div className="card__strip">
        <span>tool</span>
        <span className="card__by">
          {took(tool)}
          {tool.perMaster ? ' a master' : ''}
        </span>
      </div>
      <div className="card__name card__name--mono">{tool.script}</div>
      <div className="card__what">{tool.what}</div>
      <div className="card__ran">run by {tool.ranBy}</div>
    </div>
  );
}

export function ProgramCard({ data }: NodeProps<CardNode>) {
  const program = PROGRAMS[data.card.ref as keyof typeof PROGRAMS];
  return (
    <div className={`card card--run ${data.state}`}>
      <Ends sides />
      <div className="card__strip">
        <span>runs</span>
      </div>
      <div className="card__name">{program.name}</div>
      <code className="card__path">{program.where}</code>
      <div className="card__what">{program.what}</div>
    </div>
  );
}

export function LiveCard({ data }: NodeProps<CardNode>) {
  const live = LIVE.find((l) => l.id === data.card.ref)!;
  return (
    <div className={`card card--run card--live ${data.state}`}>
      <Ends sides />
      <div className="card__strip">
        <span>runs</span>
        <span className="card__by">not a file: gone when it stops</span>
      </div>
      <div className="card__name">{live.name}</div>
      <code className="card__path">{live.where}</code>
      <div className="card__what">{live.what}</div>
    </div>
  );
}

/** The dotted line between what is baked beforehand and what runs. */
export function LineCard({ data }: NodeProps<Node<{ width: number }>>) {
  return (
    <div className="card-line" style={{ width: data.width }}>
      <span className="card-line__above">↑ baked beforehand, on the machine, before the game starts</span>
      <span className="card-line__below">↓ running: what the game reads and keeps while it plays</span>
    </div>
  );
}

export const CARD_TYPES = {
  file: FileCard,
  tool: ToolCard,
  program: ProgramCard,
  live: LiveCard,
  line: LineCard,
};

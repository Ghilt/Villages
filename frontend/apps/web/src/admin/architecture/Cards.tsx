import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { Fragment } from 'react';

import type { Card } from './graph';
import { took } from './Timeline';
import { WORLD_CACHE } from './cache';
import { TOOLS, artifact, group, piece } from './world';
import type { Piece } from './world';

/** What a card is told: which card it is, and whether it is chosen, lit by the choice, or dimmed. */
export type CardData = { card: Card; state: string; words?: { x: number; y: number; width: number } };
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

/** The robot: what an agent reads or runs while it works on the world, and the game never does. */
export function Robot() {
  return (
    <svg className="card__robot" viewBox="0 0 16 16" role="img" aria-label="for development">
      <path d="M8 1.6v2" />
      <circle cx="8" cy="1.4" r="0.6" />
      <rect x="3" y="3.6" width="10" height="7.4" rx="2" />
      <circle cx="6.1" cy="6.9" r="0.9" />
      <circle cx="9.9" cy="6.9" r="0.9" />
      <path d="M6.2 9.2h3.6 M1.4 6v2.6 M14.6 6v2.6 M5.6 11v3h4.8v-3" />
    </svg>
  );
}

function Ends() {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  );
}

const SIDES = [
  ['top', Position.Top],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
  ['right', Position.Right],
] as const;

/**
 * A running piece talks to the pieces around it on whichever side faces them, so it has a way in and a way out
 * on every side; the baked files' arrows arrive at the top, at the handle with no name.
 */
function Sides() {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {SIDES.map(([side, position]) => (
        <Fragment key={side}>
          <Handle id={`${side}-in`} type="target" position={position} isConnectable={false} />
          <Handle id={`${side}-out`} type="source" position={position} isConnectable={false} />
        </Fragment>
      ))}
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
        {a.development !== undefined && <Robot />}
      </div>
      <div className="card__name">{a.name}</div>
      <code className="card__path">{a.path}</code>
      <div className="card__what">{a.what}</div>
      {a.development !== undefined && <div className="card__for">for development: {a.development}</div>}
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
        {tool.development !== undefined && <Robot />}
      </div>
      <div className="card__name card__name--mono">{tool.script}</div>
      <div className="card__what">{tool.what}</div>
      <div className="card__ran">run by {tool.ranBy}</div>
      {tool.development !== undefined && <div className="card__for">for development: {tool.development}</div>}
    </div>
  );
}

const RUNS = { browser: 'in the browser', server: 'in the game server', docker: 'in Docker' } as const;

/** What a piece's strip says on its right: that it is not built yet, or stands in for another, or nothing. */
function noteOf(p: Piece): string | null {
  if (p.yet !== undefined) return `not used until ${p.yet}`;
  if (p.instead !== undefined) return 'without Docker';
  return null;
}

export function PieceCard({ data }: NodeProps<CardNode>) {
  const p = piece(data.card.ref);
  const note = noteOf(p);
  const how = [p.yet !== undefined && 'card--yet', p.instead !== undefined && 'card--instead'].filter(
    Boolean,
  );
  return (
    <div className={`card card--run card--${p.runs} ${how.join(' ')} ${data.state}`}>
      <Sides />
      <div className="card__strip">
        <span>runs {RUNS[p.runs]}</span>
        {note !== null && <span className="card__by">{note}</span>}
      </div>
      <div className="card__name">{p.name}</div>
      <code className="card__path">{p.where}</code>
      <div className="card__what">{p.what}</div>
    </div>
  );
}

/** A box round the pieces that fit together, saying what they are together. */
export function GroupCard({ data }: NodeProps<CardNode>) {
  const g = group(data.card.ref);
  return (
    <div className={`run-group run-group--${g.id} ${data.state}`}>
      {/* The baked files the game server reads arrive here, to one side of the page standing above. */}
      <Handle type="target" position={Position.Top} isConnectable={false} style={{ left: '10%' }} />
      <div className="run-group__name">
        {g.name} <code>{g.where}</code>
      </div>
      <div className="run-group__what">{g.what}</div>
    </div>
  );
}

/** The world cache's box round the master's tools and what they make, saying at its head what it is. */
export function ShelfCard({ data }: NodeProps<CardNode>) {
  return (
    <div className={`shelf ${data.state}`}>
      <div
        className="shelf__words"
        style={
          data.words === undefined ? {} : { left: data.words.x, top: data.words.y, width: data.words.width }
        }
      >
        <div className="shelf__name">
          {WORLD_CACHE.name} <code>{WORLD_CACHE.where}</code>
        </div>
        <div className="shelf__what">{WORLD_CACHE.what}</div>
      </div>
    </div>
  );
}

/**
 * A line across the diagram, saying what is above it and what below: the dotted one between what is baked
 * beforehand and what runs, or the one under what the world is made from.
 */
export function LineCard({
  data,
}: NodeProps<Node<{ width: number; kind?: string; above?: string; below?: string }>>) {
  return (
    <div
      className={`card-line ${data.kind === undefined ? '' : `card-line--${data.kind}`}`}
      style={{ width: data.width }}
    >
      <span className="card-line__above">
        {data.above ?? '↑ baked beforehand, on the machine, before the game starts'}
      </span>
      <span className="card-line__below">
        {data.below ?? '↓ running: what the game reads and keeps while it plays'}
      </span>
    </div>
  );
}

export const CARD_TYPES = {
  file: FileCard,
  tool: ToolCard,
  piece: PieceCard,
  group: GroupCard,
  shelf: ShelfCard,
  line: LineCard,
};

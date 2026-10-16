import '@xyflow/react/dist/style.css';
import './diagram.css';
import './shelf.css';

import { Background, Controls, MarkerType, MiniMap, ReactFlow } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import { useMemo } from 'react';

import { CARD_TYPES } from './Cards';
import type { Card } from './graph';
import type { Drawn, Line, Placed } from './layout';
import { artifact } from './world';

/**
 * The diagram: every card where the layout put it, arrows from what is read to what reads it, and the
 * dotted line between baked and running. Beneath it, the running pieces stand in the boxes of the groups they fit
 * in, the shaders in a box of their own inside the page's, and say on every arrow between them what passes along
 * it. Cards cannot be joined by hand; choosing one lights its chain and says the rest of what it is.
 */
export function Diagram(props: {
  placed: readonly Placed[];
  arrows: readonly Drawn[];
  line: Line;
  sources: Line;
  stateOf: (card: string) => string;
  choose: (card: string | null) => void;
}) {
  const { placed, arrows, line, sources, stateOf, choose } = props;

  const nodes = useMemo<Node[]>(
    () => [
      {
        id: 'line',
        type: 'line',
        position: { x: line.x, y: line.y },
        data: { width: line.width },
        selectable: false,
        draggable: false,
      },
      {
        id: 'line:sources',
        type: 'line',
        position: { x: sources.x, y: sources.y },
        data: {
          width: sources.width,
          kind: 'sources',
          above: '↑ what the world is made from: written by Adam, or downloaded',
          below: '↓ what the tools make of it',
        },
        selectable: false,
        draggable: false,
      },
      // A group comes before the pieces inside it, which stand where the layout put them in its box.
      ...placed.map((p) => ({
        id: p.card.id,
        type: p.card.kind,
        position: { x: p.x, y: p.y },
        width: p.width,
        height: p.height,
        ...(p.parent === undefined ? {} : { parentId: p.parent }),
        ...(p.card.kind === 'group' || p.card.kind === 'cluster' || p.card.kind === 'shelf'
          ? { zIndex: -1 }
          : {}),
        data: {
          card: p.card,
          state: stateOf(p.card.id),
          ...(p.words === undefined ? {} : { words: p.words }),
        },
      })),
    ],
    [placed, line, sources, stateOf],
  );

  const edges = useMemo<Edge[]>(
    () =>
      arrows.map((a) => {
        const state = edgeState(stateOf(a.from), stateOf(a.to));
        return {
          id: a.id,
          source: a.from,
          target: a.to,
          className: `arrow ${a.flow ? '' : 'arrow--talk'} ${a.when ? `arrow--${a.when}` : ''} ${state}`,
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          ...(a.flow
            ? {}
            : {
                sourceHandle: `${a.fromSide}-out`,
                targetHandle: `${a.toSide}-in`,
                type: 'smoothstep',
                label: a.says,
                labelBgPadding: [6, 3] as [number, number],
                labelBgBorderRadius: 3,
                ...(a.both ? { markerStart: { type: MarkerType.ArrowClosed, width: 14, height: 14 } } : {}),
              }),
        };
      }),
    [arrows, stateOf],
  );

  return (
    <div className="diagram">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={CARD_TYPES}
        onNodeClick={(_, node) => choose(node.id.startsWith('line') ? null : node.id)}
        onPaneClick={() => choose(null)}
        nodesConnectable={false}
        nodesDraggable={false}
        fitView
        minZoom={0.1}
        maxZoom={1.6}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={colourOf} />
      </ReactFlow>
    </div>
  );
}

/** An arrow is lit when both its ends are, and dimmed when either is. */
function edgeState(from: string, to: string): string {
  if (from === '' && to === '') return '';
  const on = (s: string) => s === 'is-lit' || s === 'is-chosen';
  return on(from) && on(to) ? 'is-lit' : 'is-dim';
}

const ORIGIN_COLOUR = { authored: '#e2c27f', fetched: '#8fb3d3', baked: '#c9bfae' } as const;

/** A card's colour in the minimap: the same story as the cards, told in blocks. */
function colourOf(node: Node): string {
  const card = (node.data as { card?: Card }).card;
  if (card === undefined) return 'transparent';
  if (card.kind === 'tool') return '#3b3229';
  if (card.kind === 'file') return ORIGIN_COLOUR[artifact(card.ref).origin];
  if (card.kind === 'group') return '#dcefe3';
  if (card.kind === 'cluster') return '#c7e3d1';
  if (card.kind === 'shelf') return 'rgb(236 230 218 / 60%)';
  return '#2e6b4f';
}

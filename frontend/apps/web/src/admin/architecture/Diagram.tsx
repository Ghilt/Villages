import '@xyflow/react/dist/style.css';
import './diagram.css';

import { Background, Controls, MarkerType, MiniMap, ReactFlow } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import { useMemo } from 'react';

import { CARD_TYPES } from './Cards';
import type { Arrow, Card } from './graph';
import type { Line, Placed } from './layout';
import { artifact } from './world';

/**
 * The diagram: every card where the layout put it, arrows from what is read to what reads it, and the
 * dotted line between baked and running. Cards cannot be joined by hand; choosing one lights its chain.
 */
export function Diagram(props: {
  placed: readonly Placed[];
  arrows: readonly Arrow[];
  line: Line;
  stateOf: (card: string) => string;
  choose: (card: string | null) => void;
}) {
  const { placed, arrows, line, stateOf, choose } = props;

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
      ...placed.map((p) => ({
        id: p.card.id,
        type: p.card.kind,
        position: { x: p.x, y: p.y },
        width: p.width,
        // A running card is as tall as what it says; the rest are as tall as the layout made room for.
        ...(p.card.kind === 'program' || p.card.kind === 'live' ? {} : { height: p.height }),
        data: { card: p.card, state: stateOf(p.card.id) },
      })),
    ],
    [placed, line, stateOf],
  );

  const edges = useMemo<Edge[]>(
    () =>
      arrows.map((a) => {
        const state = edgeState(stateOf(a.from), stateOf(a.to));
        return {
          id: a.id,
          source: a.from,
          target: a.to,
          className: `arrow ${a.flow ? '' : 'arrow--talk'} ${state}`,
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          ...(a.flow
            ? {}
            : {
                sourceHandle: 'right',
                targetHandle: 'left',
                type: 'straight',
                markerStart: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
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
        onNodeClick={(_, node) => choose(node.id === 'line' ? null : node.id)}
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
  return '#2e6b4f';
}

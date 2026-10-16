import '@xyflow/react/dist/style.css';

import { Background, MarkerType, ReactFlow } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import { useMemo } from 'react';

import type { Dialogue } from '@villages/world';

import { LINE, layOutDialogue } from './layout';

/** A line's words cut to what fits on its card. */
const MOST = 90;

/**
 * A dialogue drawn as its tree: a card a line, who says it and what they say, the house's party on the left's colour
 * and the other's on the right's, a choice's options under it joined by dashed leads; the chosen line ringed. Pressing
 * a card chooses it. Lines cannot be moved or joined by hand: the file says where each leads.
 */
export function Tree({
  dialogue,
  chosen,
  choose,
}: {
  dialogue: Dialogue;
  chosen: string | null;
  choose: (line: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const { placed, leads } = layOutDialogue(dialogue);
    const partyOf = new Map(dialogue.speakers.map((speaker) => [speaker.id, speaker.party]));
    const byId = new Map(dialogue.lines.map((line) => [line.id, line]));
    const nodes: Node[] = placed.map((at) => {
      const line = byId.get(at.id)!;
      const words = line.says.length > MOST ? `${line.says.slice(0, MOST - 1)}…` : line.says;
      return {
        id: at.id,
        position: { x: at.x, y: at.y },
        data: { label: `${line.by}: ${words}` },
        style: { width: LINE.width, height: LINE.height },
        className: `dialogue-line dialogue-line--party${partyOf.get(line.by) ?? 0}${line.then === null ? ' dialogue-line--end' : ''}`,
        draggable: false,
        connectable: false,
      };
    });
    const edges: Edge[] = leads.map((lead) => ({
      id: `${lead.from}->${lead.to}`,
      source: lead.from,
      target: lead.to,
      markerEnd: { type: MarkerType.ArrowClosed },
      className: lead.option ? 'dialogue-lead dialogue-lead--option' : 'dialogue-lead',
    }));
    return { nodes, edges };
  }, [dialogue]);

  return (
    <div className="dialogue-tree">
      <ReactFlow
        nodes={nodes.map((node) => ({ ...node, selected: node.id === chosen }))}
        edges={edges}
        onNodeClick={(_, node) => choose(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
      </ReactFlow>
    </div>
  );
}

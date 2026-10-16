import '@xyflow/react/dist/style.css';

import { Background, MarkerType, ReactFlow } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import { useMemo } from 'react';

import type { QuestFile, QuestNodeFile } from '@villages/world';

import { NODE, layOutQuest } from './layout';

/** What a node is, in a word or two on its card. */
function sayKind(node: QuestNodeFile): string {
  switch (node.is.kind) {
    case 'dialogue':
      return `dialogue ${node.is.dialogue}`;
    case 'objectives':
      return `${node.is.objectives.length} ${node.is.objectives.length === 1 ? 'objective' : 'objectives'}`;
    case 'reward':
      return 'reward';
  }
}

/**
 * A quest drawn as its road: a card a node, its title and what it is, a question mark's card dashed and one shown
 * ahead ringed lightly; a fork's roads named by the endings that take them; the chosen card ringed. Pressing a card
 * chooses it. Nodes cannot be moved or joined by hand: the file says where each leads.
 */
export function Road({
  quest,
  chosen,
  choose,
}: {
  quest: QuestFile;
  chosen: string | null;
  choose: (node: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const { placed, roads } = layOutQuest(quest);
    const byId = new Map(quest.nodes.map((node) => [node.id, node]));
    const nodes: Node[] = placed.map((at) => {
      const node = byId.get(at.id)!;
      return {
        id: at.id,
        position: { x: at.x, y: at.y },
        data: { label: `${node.title} · ${sayKind(node)}` },
        style: { width: NODE.width, height: NODE.height },
        className: [
          'quest-node',
          `quest-node--${node.is.kind}`,
          node.hidden ? 'quest-node--hidden' : '',
          node.shownAhead ? 'quest-node--ahead' : '',
        ].join(' '),
        draggable: false,
        connectable: false,
      };
    });
    const edges: Edge[] = roads.map((road) => ({
      id: `${road.from}->${road.to}`,
      source: road.from,
      target: road.to,
      label: road.endings.length === 0 ? undefined : `after ${road.endings.join(', ')}`,
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
    return { nodes, edges };
  }, [quest]);

  return (
    <div className="quest-road">
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
